// 1. 요청 정보
// - RefreshToken을 Request Header의 Authorization 값(`req.headers.authorization`)으로 전달 받으며,
// JWT 표준 인증 형태(`Authorization: Bearer {{ RefreshToken }}`)에 맞아야 합니다.
// 2. 유효성 검증 및 에러 처리
// - JWT 표준 인증 형태와 일치하지 않는 경우 - “지원하지 않는 인증 방식입니다.”
// - RefreshToken이 없는 경우 - “인증 정보가 없습니다.”
// - RefreshToken의 유효기한이 지난 경우 - “인증 정보가 만료되었습니다.”
// - 그 밖의 RefreshToken 검증에 실패한 경우 - “인증 정보가 유효하지 않습니다.”
// - Payload에 담긴 사용자 ID와 일치하는 사용자가 없는 경우 - “인증 정보와 일치하는 사용자가 없습니다.”
// - DB에 저장 된 RefreshToken이 없거나 전달 받은 값과 일치하지 않는 경우 - “폐기 된 인증 정보입니다.”
// 3. 비즈니스 로직(데이터 처리)
// - Payload에 담긴 사용자 ID를 이용하여 사용자 정보를 조회합니다.
// 4. 반환 정보
// - 조회 된 사용자 정보를 `req.user`에 담고, 다음 동작을 진행합니다.
