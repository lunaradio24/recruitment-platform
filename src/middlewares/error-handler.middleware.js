const errorHandler = (err, req, res, next) => {
  // CustomError로 받은 에러 처리
  if (err.code !== 500) {
    return res.status(err.code).json({ message: err.message });
  }

  // 그 밖의 예상치 못한 에러 처리
  return res.status(500).json({
    message: '예상치 못한 에러가 발생했습니다. 관리자에게 문의해 주세요.',
  });
};

export default errorHandler;
