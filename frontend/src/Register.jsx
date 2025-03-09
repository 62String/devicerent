import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Register() {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    id: '',
    password: '',
    passwordConfirm: '',
    name: '',
    affiliation: '',
    position: '연구원' // 기본값 설정
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);

  const validateId = (id) => {
    const allowedChars = /^[a-zA-Z0-9_@.\-]+$/;
    return allowedChars.test(id.trim()) && id.trim().length >= 3;
  };

  const validateName = (value) => {
    const allowedChars = /^[가-힣a-zA-Z]+$/; // 한글, 영어만 허용
    return allowedChars.test(value.trim()) && value.trim().length >= 2;
  };

  const validateAffiliation = (value) => {
    const allowedChars = /^[가-힣a-zA-Z0-9\s]+$/; // 한글, 영어, 숫자, 공백 허용
    return allowedChars.test(value.trim()) && value.trim().length >= 2;
  };

  const validatePosition = (value) => {
    const allowedPositions = ['연구원', '파트장', '팀장'];
    return allowedPositions.includes(value);
  };

  const validateForm = () => {
    const idValid = validateId(formData.id);
    const passwordMatch = formData.password === formData.passwordConfirm && formData.password.length >= 6;
    const nameValid = validateName(formData.name);
    const affiliationValid = validateAffiliation(formData.affiliation);
    const positionValid = validatePosition(formData.position);
    return idValid && passwordMatch && nameValid && affiliationValid && positionValid;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevFormData) => {
      const newFormData = { ...prevFormData, [name]: value };

      if (name === 'id') {
        const valid = validateId(value);
        setError(valid ? '' : '아이디는 영어, 숫자, _, -, @, .만 사용할 수 있으며 최소 3자 이상이어야 합니다.');
      } else if (name === 'password' || name === 'passwordConfirm') {
        const passwordValid = newFormData.password.length >= 6;
        const matchValid = newFormData.password === newFormData.passwordConfirm;
        if (!passwordValid) {
          setError('비밀번호는 최소 6자 이상이어야 합니다.');
        } else if (!matchValid) {
          setError('비밀번호가 일치하지 않습니다.');
        } else {
          setError('');
        }
      } else if (name === 'name') {
        const valid = validateName(value);
        setError(valid ? '' : value.trim().length < 2 ? '이름은 최소 2자 이상이어야 합니다.' : '이름은 한글, 영어만 사용할 수 있습니다.');
      } else if (name === 'affiliation') {
        const valid = validateAffiliation(value);
        setError(valid ? '' : value.trim().length < 2 ? '소속은 최소 2자 이상이어야 합니다.' : '소속은 한글, 영어, 숫자, 공백만 사용할 수 있습니다.');
      } else if (name === 'position') {
        const valid = validatePosition(value);
        setError(valid ? '' : '유효하지 않은 직급입니다.');
      }

      setIsFormValid(validateForm());
      return newFormData;
    });
  };

  useEffect(() => {
    setIsFormValid(validateForm());
  }, [formData.id, formData.password, formData.passwordConfirm, formData.name, formData.affiliation, formData.position]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!isFormValid) {
      setError('모든 필드를 올바르게 입력해 주세요.');
      return;
    }
    setIsSubmitting(true);
    console.log('Form Data:', formData);
    try {
      const response = await axios.post(`${apiUrl}/api/auth/register`, formData, {
        headers: { 'Content-Type': 'application/json' }
      });
      alert(response.data.message);
      navigate('/login');
    } catch (error) {
      console.error('Register error:', error.response?.data || error.message);
      setError(error.response?.data?.message || '회원가입에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px' }}>
      <h2>회원가입</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>아이디:</label>
          <input
            type="text"
            name="id"
            value={formData.id}
            onChange={handleChange}
            placeholder="아이디는 영어, 숫자, _, -, @, .만 사용 가능, 최소 3자 이상"
            required
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
        </div>
        <div>
          <label>비밀번호:</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="비밀번호"
            required
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
        </div>
        <div>
          <label>비밀번호 확인:</label>
          <input
            type="password"
            name="passwordConfirm"
            value={formData.passwordConfirm}
            onChange={handleChange}
            placeholder="비밀번호 확인"
            required
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
        </div>
        <div>
          <label>이름:</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="이름"
            required
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
        </div>
        <div>
          <label>소속:</label>
          <input
            type="text"
            name="affiliation"
            value={formData.affiliation}
            onChange={handleChange}
            placeholder="소속"
            required
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
        </div>
        <div>
          <label>직급:</label>
          <select
            name="position"
            value={formData.position}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          >
            <option value="연구원">연구원</option>
            <option value="파트장">파트장</option>
            <option value="팀장">팀장</option>
          </select>
        </div>
        <button type="submit" style={{ padding: '10px 20px' }} disabled={!isFormValid || isSubmitting}>
          등록
        </button>
      </form>
      <p>
        계정이 있으신가요? <a href="/login">여기서 로그인</a>
      </p>
    </div>
  );
}

export default Register;