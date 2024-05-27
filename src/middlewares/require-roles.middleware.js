import { prisma } from '../utils/prisma.util.js';

const requireRoles = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      // 사용자 정보는 인증 미들웨어를 통해 `req.user`에 전달된다고 가정합니다.
      const user = req.user;
      const { role } = await prisma.userInfos.findUnique({
        where: { UserId: user.userId },
        select: {
          role: true,
        },
      });

      // 사용자의 역할이 허용된 역할 목록에 포함되는지 확인
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ errorMessage: '접근 권한이 없습니다.' });
      }

      // 역할이 허용된 경우 다음 미들웨어로 진행
      next();
    } catch (error) {
      next(error);
    }
  };
};

export default requireRoles;
