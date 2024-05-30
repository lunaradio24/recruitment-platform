import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { prisma } from '../utils/prisma.util.js';
import { CustomError } from '../utils/custom-error.util.js';
import { HTTP_STATUS } from '../constants/http-status.constant.js';

const requireRefreshToken = async (req, res, next) => {
  try {
    // 1. 요청 정보 - Headers 에서 토큰 정보 가져오기
    const authorization = req.headers['authorization'];

    // 2. 유효성 검증 및 에러 처리
    //  - authorization 또는 RefreshToken이 없는 경우
    if (!authorization) throw new CustomError(HTTP_STATUS.UNAUTHORIZED, '인증 정보가 없습니다.');

    //  - JWT 표준 인증 형태와 일치하지 않는 경우
    const [tokenType, token] = authorization.split(' ');
    if (tokenType !== 'Bearer') throw new CustomError(HTTP_STATUS.UNAUTHORIZED, '지원하지 않는 인증 방식입니다.');

    // 3. 비즈니스 로직(데이터 처리)
    //  - Payload에 담긴 사용자 ID를 이용하여 사용자 정보를 조회합니다.
    const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET_KEY) ?? null;
    const { authId } = payload;
    const user = await prisma.users.findUnique({ where: { authId: authId } });

    //  - Payload에 담긴 사용자 ID와 일치하는 사용자가 없는 경우
    if (!user) throw new CustomError(HTTP_STATUS.UNAUTHORIZED, '인증 정보와 일치하는 사용자가 없습니다.');

    //   - 사용자가 가지고 있는 RefreshToken이 DB에 저장된 것과 일치하는지 확인
    const { tokenId: savedRefreshToken } = await prisma.refreshTokens.findUnique({
      where: { authId: authId },
    });
    const isMatched = await bcrypt.compare(token, savedRefreshToken);
    if (!isMatched) throw new CustomError(HTTP_STATUS.UNAUTHORIZED, '폐기된 인증 정보입니다..');

    // 4. 반환 정보
    req.user = user;
    next();

    // 5. 발생한 에러는 catch로 받아서 다음 미들웨어에서 처리
  } catch (error) {
    next(error);
  }
};

export default requireRefreshToken;
