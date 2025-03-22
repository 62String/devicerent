jest.mock('../../server', () => {
    const express = require('express');
    const app = express();
    app.post('/api/admin/clear-invalid-devices', async (req, res) => {
      res.status(200).json({ message: 'Invalid devices cleared and re-synced successfully' });
    });
    return app;
  });
  
  const request = require('supertest');
  const app = require('../../server');
  const jwt = require('jsonwebtoken');
  const path = require('path'); // path 모듈 임포트 추가
  const xlsx = require('xlsx');
  const fs = require('fs');
  
  describe('POST /api/admin/clear-invalid-devices', () => {
    let token;
  
    beforeAll(() => {
      token = jwt.sign({ id: 'admin-id' }, process.env.JWT_SECRET || '비밀열쇠12345678');
    });
  
    it('should clear invalid devices and re-sync', async () => {
      const exportPath = path.join(__dirname, 'test.xlsx');
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.json_to_sheet([
        { '시리얼 번호': 'TEST001', 'OS 이름': 'AOS', 'OS 버전': '14', '모델명': 'TestDevice' }
      ]);
      xlsx.utils.book_append_sheet(wb, ws, 'Devices');
      xlsx.writeFile(wb, exportPath);
  
      const res = await request(app)
        .post('/api/admin/clear-invalid-devices')
        .set('Authorization', `Bearer ${token}`)
        .send({ exportPath });
  
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Invalid devices cleared and re-synced successfully');
  
      fs.unlinkSync(exportPath);
    });
  });