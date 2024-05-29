import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { prisma } from '../utils/prisma.util.js';
import { CustomError } from '../utils/custom-error.util.js';

const requireAccessToken = async (req, res, next) => {
  try {
    // 1. 요청 정보 - Headers 에서 토큰 정보 가져오기
    const authorization = req.headers['authorization'];

    // 2. 유효성 검증 및 에러 처리
    //  - Authorization 또는 AccessToken이 없는 경우
    if (!authorization) throw new CustomError(401, '인증 정보가 없습니다.');

    //  - JWT 표준 인증 형태와 일치하지 않는 경우
    const [tokenType, token] = authorization.split(' ');
    if (tokenType !== 'Bearer') throw new CustomError(401, '지원하지 않는 인증 방식입니다.');

    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET_KEY) ?? null;

    // 3. 비즈니스 로직(데이터 처리)
    //  - Payload에 담긴 사용자 ID를 이용하여 사용자 정보를 조회합니다.
    const { authId } = payload;
    const user = await prisma.users.findUnique({ where: { authId: authId } });

    //  - Payload에 담긴 사용자 ID와 일치하는 사용자가 없는 경우
    if (!user) throw new CustomError(401, '인증 정보와 일치하는 사용자가 없습니다.');

    // 4. 반환 정보
    req.user = user;
    next();

    // 5. 발생한 에러는 catch로 받아서 다음 미들웨어에서 처리
  } catch (error) {
    next(error);
  }
};

export default requireAccessToken;
