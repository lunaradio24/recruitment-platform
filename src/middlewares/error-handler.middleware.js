const errorHandler = (err, req, res, next) => {
  switch (err.name) {
    //JWT verify method에서 발생한 에러 처리
    case 'TokenExpiredError':
      return res.status(401).json({ message: '인증 정보가 만료되었습니다.' });
    case 'JsonWebTokenError':
      return res.status(401).json({ message: '인증 정보가 유효하지 않습니다.' });
    // CustomError로 받은 에러 처리
    case 'CustomError':
      return res.status(err.code).json({ message: err.message });
    // 그 밖의 예상치 못한 에러 처리
    default:
      return res
        .status(err.code || 500)
        .json({ message: err.message ?? '예상치 못한 에러가 발생했습니다. 관리자에게 문의해 주세요.' });
  }
};

export default errorHandler;
