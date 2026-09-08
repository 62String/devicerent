const request = require('supertest');
  const express = require('express');
  const User = require('../../../models/User');
  const DeletedUser = require('../../../models/DeletedUser');
  const UserRoleChangeLog = require('../../../models/UserRoleChangeLog');
  const mongoose = require('mongoose');
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const jwt = require('jsonwebtoken');
  const usersRoutes = require('../../../routes/admin/users');

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/admin', usersRoutes);

  describe('Admin Users API', () => {
    let mongoServer;
    let adminToken;
    let userToken;

    beforeAll(async () => {
      jest.setTimeout(60000);
      mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 60000,
        connectTimeoutMS: 60000
      });
      adminToken = jwt.sign({ id: 'admin-id', isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '1h' });
      userToken = jwt.sign({ id: 'pending-user', isAdmin: false }, process.env.JWT_SECRET, { expiresIn: '1h' });
    }, 60000);

    afterAll(async () => {
      await mongoose.disconnect();
      await mongoServer.stop();
    }, 60000);

    beforeEach(async () => {
      await User.deleteMany({});
      await DeletedUser.deleteMany({});
      await UserRoleChangeLog.deleteMany({});
      await User.create({
        id: 'admin-id',
        name: 'Admin User',
        affiliation: 'Admin Org',
        position: '센터장',
        password: 'adminpassword',
        isPending: false,
        isAdmin: true,
        roleLevel: 0
      });
      await User.create({
        id: 'pending-user',
        name: 'Pending User',
        affiliation: 'Test Org',
        position: '연구원',
        password: 'testpassword',
        isPending: true,
        isAdmin: false,
        roleLevel: 99
      });
      await User.create({
        id: 'approved-user',
        name: 'Approved User',
        affiliation: 'Test Org',
        position: '연구원',
        password: 'testpassword',
        isPending: false,
        isAdmin: false,
        roleLevel: 99
      });
    }, 10000);

    describe('GET /api/admin/users/pending', () => {
      it('should fail if not admin', async () => {
        const res = await request(app)
          .get('/api/admin/users/pending')
          .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(403);
        expect(res.body.message).toBe('승인된 사용자만 가능합니다.');
      }, 10000);

      it('should return pending users', async () => {
        const res = await request(app)
          .get('/api/admin/users/pending')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.users).toHaveLength(1);
        expect(res.body.users[0]).toEqual({
          id: 'pending-user',
          name: 'Pending User',
          affiliation: 'Test Org'
        });
      }, 10000);

      it('should return empty list if no pending users', async () => {
        await User.deleteMany({ isPending: true }); // 승인 대기 사용자만 삭제
        const res = await request(app)
          .get('/api/admin/users/pending')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.users).toHaveLength(0);
      }, 10000);
    });

    describe('GET /api/admin/users', () => {
      it('should fail if not admin', async () => {
        const res = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(403);
        expect(res.body.message).toBe('승인된 사용자만 가능합니다.');
      }, 10000);

      it('should return approved users', async () => {
        const res = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.users).toHaveLength(2);
        expect(res.body.users).toContainEqual({
          id: 'admin-id',
          name: 'Admin User',
          affiliation: 'Admin Org',
          isAdmin: true,
          roleLevel: 0
        });
        expect(res.body.users).toContainEqual({
          id: 'approved-user',
          name: 'Approved User',
          affiliation: 'Test Org',
          isAdmin: false,
          roleLevel: 99
        });
      }, 10000);

      it('should return empty list if no approved users', async () => {
        await User.deleteMany({ isPending: false }); // 모든 승인된 사용자 삭제
        await User.create({ // 관리자 다시 생성
          id: 'admin-id',
          name: 'Admin User',
          affiliation: 'Admin Org',
          position: '센터장',
          password: 'adminpassword',
          isPending: false,
          isAdmin: true,
          roleLevel: 0
        });
        const admin = await User.findOne({ id: 'admin-id' });
        expect(admin).toBeTruthy(); // 관리자 생성 확인
        const res = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.users).toHaveLength(1); // 관리자만 남음
        expect(res.body.users[0].id).toBe('admin-id');
      }, 10000);
    });

    describe('POST /api/admin/users/approve', () => {
      it('should fail if not admin', async () => {
        const res = await request(app)
          .post('/api/admin/users/approve')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ id: 'pending-user' });

        expect(res.status).toBe(403);
        expect(res.body.message).toBe('승인된 사용자만 가능합니다.');
      }, 10000);

      it('should fail if user not found', async () => {
        const res = await request(app)
          .post('/api/admin/users/approve')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ id: 'non-existent-user' });

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('사용자를 찾을 수 없습니다.');
      }, 10000);

      it('should approve a pending user', async () => {
        const res = await request(app)
          .post('/api/admin/users/approve')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ id: 'pending-user' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('사용자가 승인되었습니다.');

        const user = await User.findOne({ id: 'pending-user' });
        expect(user.isPending).toBe(false);
      }, 10000);
    });

    describe('POST /api/admin/users/role-level', () => {
      it('should update a user role level and record the change', async () => {
        const res = await request(app)
          .post('/api/admin/users/role-level')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ id: 'approved-user', roleLevel: 1, reason: '운영 담당자 지정' });

        expect(res.status).toBe(200);
        expect(res.body.user).toMatchObject({ id: 'approved-user', roleLevel: 1, isAdmin: true });

        const user = await User.findOne({ id: 'approved-user' });
        expect(user.roleLevel).toBe(1);
        expect(user.isAdmin).toBe(true);

        const log = await UserRoleChangeLog.findOne({ targetUserId: 'approved-user' });
        expect(log).toMatchObject({
          previousRoleLevel: 99,
          newRoleLevel: 1,
          reason: '운영 담당자 지정',
          performedBy: 'admin-id'
        });
      }, 10000);

      it('should reject changing the current administrator role level', async () => {
        const res = await request(app)
          .post('/api/admin/users/role-level')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ id: 'admin-id', roleLevel: 1 });

        expect(res.status).toBe(403);
        expect(res.body.message).toBe('본인의 관리레벨은 변경할 수 없습니다.');
      }, 10000);

      it('should reject an unsupported role level', async () => {
        const res = await request(app)
          .post('/api/admin/users/role-level')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ id: 'approved-user', roleLevel: 3 });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('유효한 사용자와 관리레벨을 선택해주세요.');
      }, 10000);

      it('should reject a non-master user', async () => {
        const res = await request(app)
          .post('/api/admin/users/role-level')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ id: 'approved-user', roleLevel: 1 });

        expect(res.status).toBe(403);
        expect(res.body.message).toBe('승인된 사용자만 가능합니다.');
      }, 10000);
    });

    describe('POST /api/admin/users/reject', () => {
      it('should fail if not admin', async () => {
        const res = await request(app)
          .post('/api/admin/users/reject')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ id: 'pending-user', reason: 'Test rejection' });

        expect(res.status).toBe(403);
        expect(res.body.message).toBe('승인된 사용자만 가능합니다.');
      }, 10000);

      it('should fail if user not found', async () => {
        const res = await request(app)
          .post('/api/admin/users/reject')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ id: 'non-existent-user', reason: 'Test rejection' });

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('사용자를 찾을 수 없습니다.');
      }, 10000);

      it('should reject a user and save to DeletedUser', async () => {
        const res = await request(app)
          .post('/api/admin/users/reject')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ id: 'pending-user', reason: 'Test rejection' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('사용자가 거절되었습니다.');

        const user = await User.findOne({ id: 'pending-user' });
        expect(user).toBeNull();

        const deletedUser = await DeletedUser.findOne({ id: 'pending-user' });
        expect(deletedUser).toBeTruthy();
        expect(deletedUser.reason).toBe('Test rejection');
      }, 10000);
    });

    describe('POST /api/admin/users/delete', () => {
      it('should fail if not admin', async () => {
        const res = await request(app)
          .post('/api/admin/users/delete')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ id: 'approved-user', reason: 'Test deletion' });

        expect(res.status).toBe(403);
        expect(res.body.message).toBe('승인된 사용자만 가능합니다.');
      }, 10000);

      it('should fail if user not found', async () => {
        const res = await request(app)
          .post('/api/admin/users/delete')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ id: 'non-existent-user', reason: 'Test deletion' });

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('사용자를 찾을 수 없습니다.');
      }, 10000);

      it('should fail if deleting own account', async () => {
        const res = await request(app)
          .post('/api/admin/users/delete')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ id: 'admin-id', reason: 'Test deletion' });

        expect(res.status).toBe(403);
        expect(res.body.message).toBe('본인 계정은 삭제할 수 없습니다.');
      }, 10000);

      it('should fail if deleting higher or equal role level', async () => {
        await User.create({
          id: 'higher-user',
          name: 'Higher User',
          affiliation: 'Test Org',
          position: '센터장',
          password: 'testpassword',
          isPending: false,
          isAdmin: true,
          roleLevel: 0
        });

        const higherUser = await User.findOne({ id: 'higher-user' });
        expect(higherUser).toBeTruthy(); // higher-user 생성 확인
        expect(higherUser.roleLevel).toBe(0); // roleLevel 확인

        const res = await request(app)
          .post('/api/admin/users/delete')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ id: 'higher-user', reason: 'Test deletion' });

        expect(res.status).toBe(403);
        expect(res.body.message).toBe('상위 또는 동일 관리레벨은 삭제할 수 없습니다.');
      }, 10000);

      it('should delete a user and save to DeletedUser', async () => {
        const res = await request(app)
          .post('/api/admin/users/delete')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ id: 'approved-user', reason: 'Test deletion' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('사용자가 삭제되었습니다.');

        const user = await User.findOne({ id: 'approved-user' });
        expect(user).toBeNull();

        const deletedUser = await DeletedUser.findOne({ id: 'approved-user' });
        expect(deletedUser).toBeTruthy();
        expect(deletedUser.reason).toBe('Test deletion');
      }, 10000);
    });
  });
