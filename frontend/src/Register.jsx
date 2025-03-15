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
    position: '연구원'
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isIdChecked, setIsIdChecked] = useState(false); // 중복 체크 상태
  const [touched, setTouched] = useState({}); // 입력 시작 여부 추적

  const validateId = (id) => {
    const allowedChars = /^[a-zA-Z0-9_@.\-]+$/;
    const valid = allowedChars.test(id.trim()) && id.trim().length >= 3;
    console.log('validateId:', id, 'Valid:', valid);
    return valid;
  };

  const validateName = (value) => {
    const allowedChars = /^[가-힣a-zA-Z]+$/;
    const valid = allowedChars.test(value.trim()) && value.trim().length >= 2;
    console.log('validateName:', value, 'Valid:', valid);
    return valid;
  };

  const validateAffiliation = (value) => {
    const allowedChars = /^[가-힣a-zA-Z0-9\s]+$/;
    const valid = allowedChars.test(value.trim()) && value.trim().length >= 2;
    console.log('validateAffiliation:', value, 'Valid:', valid);
    return valid;
  };

  const validateForm = () => {
    const idValid = validateId(formData.id);
    const passwordMatch = formData.password === formData.passwordConfirm && formData.password.length >= 6;
    const nameValid = validateName(formData.name);
    const affiliationValid = validateAffiliation(formData.affiliation);

    const newErrors = {};
    if (touched.id && !idValid) newErrors.id = '아이디는 영어, 숫자, _, -, @, .만 사용 가능, 최소 3자 이상';
    if (touched.password && !passwordMatch) {
      newErrors.password = formData.password.length < 6 ? '비밀번호는 최소 6자 이상' : '비밀번호가 일치하지 않습니다';
    }
    if (touched.name && !nameValid) newErrors.name = formData.name.length < 2 ? '이름은 최소 2자 이상' : '이름은 한글, 영어만 사용 가능';
    if (touched.affiliation && !affiliationValid) {
      newErrors.affiliation = formData.affiliation.length < 2 ? '소속은 최소 2자 이상' : '소속은 한글, 영어, 숫자, 공백만 사용 가능';
    }
    setErrors(newErrors);

    const valid = idValid && passwordMatch && nameValid && affiliationValid && isIdChecked;
    console.log('validateForm - Form valid:', valid, 'Errors:', newErrors, 'isIdChecked:', isIdChecked);
    return valid;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    console.log('handleChange - Field:', name, 'Value:', value);
    setFormData((prevFormData) => ({
      ...prevFormData,
      [name]: value
    }));
    setTouched((prev) => ({ ...prev, [name]: true })); // 입력 시작 표시
    setIsFormValid(validateForm());
  };

  const handleIdCheck = async () => {
    if (!formData.id) {
      setErrors((prev) => ({ ...prev, id: '아이디를 입력해주세요' }));
      alert('아이디를 입력해주세요.');
      return;
    }
    if (!validateId(formData.id)) {
      setErrors((prev) => ({ ...prev, id: '아이디는 영어, 숫자, _, -, @, .만 사용 가능, 최소 3자 이상' }));
      alert('아이디는 영어, 숫자, _, -, @, .만 사용 가능하며 최소 3자 이상이어야 합니다.');
      return;
    }
    try {
      console.log('Checking ID availability:', formData.id);
      const response = await axios.post(`${apiUrl}/api/auth/check-id`, { id: formData.id });
      console.log('ID check response:', response.data);
      if (response.data.available) {
        setIsIdChecked(true);
        setErrors((prev) => ({ ...prev, id: '' }));
        alert('사용 가능한 아이디입니다.');
      } else {
        setIsIdChecked(false);
        setErrors((prev) => ({ ...prev, id: '이미 사용 중인 아이디입니다.' }));
        alert('이미 사용 중인 아이디입니다.');
      }
    } catch (error) {
      console.error('ID check error:', error.response?.data || error.message);
      setErrors((prev) => ({ ...prev, id: '아이디 확인 중 오류가 발생했습니다.' }));
      alert('아이디 확인 중 오류가 발생했습니다.');
    }
    setIsFormValid(validateForm());
  };

  useEffect(() => {
    console.log('useEffect - Current formData:', formData, 'Touched:', touched);
    if (Object.keys(touched).length > 0) {
      setIsFormValid(validateForm());
    }
  }, [formData, isIdChecked]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!isFormValid) {
      console.log('Form submission blocked - Invalid form:', errors);
      setTouched({ id: true, password: true, name: true, affiliation: true }); // 모든 필드 터치로 간주
      setIsFormValid(validateForm());
      return;
    }
    setIsSubmitting(true);
    console.log('Submitting form data:', formData);
    try {
      const response = await axios.post(`${apiUrl}/api/auth/register`, formData, {
        headers: { 'Content-Type': 'application/json' }
      });
      alert(response.data.message);
      navigate('/login');
    } catch (error) {
      console.error('Register error:', error.response?.data || error.message);
      setErrors({ submit: error.response?.data?.message || '회원가입에 실패했습니다. 다시 시도해 주세요.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px' }}>
      <h2>회원가입</h2>
      {errors.submit && <p style={{ color: 'red' }}>{errors.submit}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>아이디:</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              name="id"
              value={formData.id}
              onChange={handleChange}
              placeholder="아이디는 영어, 숫자, _, -, @, .만 사용 가능, 최소 3자 이상"
              required
              style={{ width: '70%', padding: '8px' }}
            />
            <button
              type="button"
              onClick={handleIdCheck}
              style={{ padding: '8px 16px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
            >
              중복 체크
            </button>
          </div>
          {errors.id && <p style={{ color: 'red', fontSize: '12px' }}>{errors.id}</p>}
        </div>
        <div>
          <label>비밀번호:</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="비밀번호 (최소 6자 이상)"
            required
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
          {errors.password && <p style={{ color: 'red', fontSize: '12px' }}>{errors.password}</p>}
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
          {errors.name && <p style={{ color: 'red', fontSize: '12px' }}>{errors.name}</p>}
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
          {errors.affiliation && <p style={{ color: 'red', fontSize: '12px' }}>{errors.affiliation}</p>}
        </div>
        <div>
          <label>직급:</label>
          <select
            name="position"
            value={formData.position}
            onChange={handleChange}
            required
            style={{ margin: '10px 0', padding: '8px', width: '100px' }}
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