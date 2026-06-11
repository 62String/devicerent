import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { DeviceIcon } from './components/Icons';

function Register() {
  const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000`;
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
  const [isIdChecked, setIsIdChecked] = useState(false);
  const [idCheckMessage, setIdCheckMessage] = useState('');
  const [touched, setTouched] = useState({});

  const validateId = (id) => {
    const allowedChars = /^[a-zA-Z0-9_@.\-]+$/;
    return allowedChars.test(id.trim()) && id.trim().length >= 3;
  };

  const validateName = (value) => {
    const allowedChars = /^[가-힣a-zA-Z]+$/;
    return allowedChars.test(value.trim()) && value.trim().length >= 2;
  };

  const validateAffiliation = (value) => {
    const allowedChars = /^[가-힣a-zA-Z0-9\s]+$/;
    return allowedChars.test(value.trim()) && value.trim().length >= 2;
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

    return idValid && passwordMatch && nameValid && affiliationValid && isIdChecked;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevFormData) => ({
      ...prevFormData,
      [name]: value
    }));
    setTouched((prev) => ({ ...prev, [name]: true }));
    if (name === 'id') {
      setIsIdChecked(false);
      setIdCheckMessage('');
    }
    setIsFormValid(validateForm());
  };

  const handleIdCheck = async () => {
    if (!formData.id) {
      setErrors((prev) => ({ ...prev, id: '아이디를 입력해주세요' }));
      return;
    }
    if (!validateId(formData.id)) {
      setErrors((prev) => ({ ...prev, id: '아이디는 영어, 숫자, _, -, @, .만 사용 가능, 최소 3자 이상' }));
      return;
    }
    try {
      const response = await axios.post(`${apiUrl}/api/auth/check-id`, { id: formData.id });
      if (response.data.available) {
        setIsIdChecked(true);
        setErrors((prev) => ({ ...prev, id: '' }));
        setIdCheckMessage('사용 가능한 아이디입니다.');
      } else {
        setIsIdChecked(false);
        setIdCheckMessage('');
        setErrors((prev) => ({ ...prev, id: '이미 사용 중인 아이디입니다.' }));
      }
    } catch (error) {
      setIsIdChecked(false);
      setIdCheckMessage('');
      setErrors((prev) => ({ ...prev, id: '아이디 확인 중 오류가 발생했습니다.' }));
    }
    setIsFormValid(validateForm());
  };

  useEffect(() => {
    if (Object.keys(touched).length > 0) {
      setIsFormValid(validateForm());
    }
  }, [formData, isIdChecked]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!isFormValid) {
      setTouched({ id: true, password: true, name: true, affiliation: true });
      setIsFormValid(validateForm());
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await axios.post(`${apiUrl}/api/auth/register`, formData, {
        headers: { 'Content-Type': 'application/json' }
      });
      alert(response.data.message);
      navigate('/login');
    } catch (error) {
      setErrors({ submit: error.response?.data?.message || '회원가입에 실패했습니다. 다시 시도해 주세요.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldError = (key) =>
    errors[key] ? <p className="text-xs mt-1 mb-0" style={{ color: 'var(--danger)' }}>{errors[key]}</p> : null;

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center justify-center gap-2 mb-6 text-ink">
          <DeviceIcon size={22} />
          <span className="text-xl font-bold tracking-tight">DeviceRent</span>
        </div>
        <div className="card" style={{ borderTop: '2px solid var(--ink)' }}>
          <div className="p-6">
            <h1 className="text-lg font-bold text-ink mb-1">가입 신청</h1>
            <p className="text-xs text-sub mb-5">가입 후 관리자 승인이 완료되면 로그인할 수 있습니다</p>
            {errors.submit && <div className="alert alert-error">{errors.submit}</div>}
            <form onSubmit={handleSubmit}>
              <label className="field-label" htmlFor="reg-id">아이디</label>
              <div className="flex gap-2 mb-1">
                <input
                  id="reg-id"
                  type="text"
                  name="id"
                  value={formData.id}
                  onChange={handleChange}
                  placeholder="영어, 숫자, _ - @ . / 3자 이상"
                  required
                  className="input flex-1"
                />
                <button type="button" onClick={handleIdCheck} className="btn btn-outline">중복 확인</button>
              </div>
              {fieldError('id')}
              {isIdChecked && idCheckMessage && (
                <p className="text-xs mt-1 mb-0" style={{ color: 'var(--ok)' }}>{idCheckMessage}</p>
              )}

              <label className="field-label mt-3" htmlFor="reg-pw">비밀번호</label>
              <input
                id="reg-pw"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="최소 6자 이상"
                required
                className="input w-full"
              />
              {fieldError('password')}

              <label className="field-label mt-3" htmlFor="reg-pw2">비밀번호 확인</label>
              <input
                id="reg-pw2"
                type="password"
                name="passwordConfirm"
                value={formData.passwordConfirm}
                onChange={handleChange}
                placeholder="비밀번호 재입력"
                required
                className="input w-full"
              />

              <label className="field-label mt-3" htmlFor="reg-name">이름</label>
              <input
                id="reg-name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="이름"
                required
                className="input w-full"
              />
              {fieldError('name')}

              <div className="flex gap-2 mt-3">
                <div className="flex-1">
                  <label className="field-label" htmlFor="reg-affiliation">소속</label>
                  <input
                    id="reg-affiliation"
                    type="text"
                    name="affiliation"
                    value={formData.affiliation}
                    onChange={handleChange}
                    placeholder="예) QA 2팀"
                    required
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="reg-position">직급</label>
                  <select
                    id="reg-position"
                    name="position"
                    value={formData.position}
                    onChange={handleChange}
                    required
                    className="input"
                  >
                    <option value="연구원">연구원</option>
                    <option value="파트장">파트장</option>
                    <option value="팀장">팀장</option>
                  </select>
                </div>
              </div>
              {fieldError('affiliation')}

              <button
                type="submit"
                className="btn btn-ink w-full mt-5"
                disabled={!isFormValid || isSubmitting}
              >
                {isSubmitting ? '신청 중...' : '가입 신청'}
              </button>
            </form>
          </div>
        </div>
        <p className="text-center text-xs text-sub mt-4">
          이미 계정이 있나요? <Link to="/login" className="link">로그인</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
