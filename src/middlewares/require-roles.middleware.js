import { CustomError } from '../utils/custom-error.util.js';

const requireRoles = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      // 1. Authorization 미들웨어를 통해 사용자 정보 가져오기
      const { role } = req.user;

      // 2. 사용자의 역할이 허용된 역할 목록에 포함되는지 확인
      if (!allowedRoles.includes(role)) throw new CustomError(403, '접근 권한이 없습니다.');

      // 3. 역할이 허용된 경우 다음 미들웨어로 진행
      next();

      // 4. 발생한 에러는 catch로 받아서 다음 미들웨어에서 처리
    } catch (error) {
      next(error);
    }
  };
};

export default requireRoles;
