// Browser-safe configuration only. Never place provider secrets in this file.

const CONFIG = {
    // 공개 클라이언트에는 보호된 n8n webhook 주소만 둘 수 있습니다. provider key와
    // MODERATION_GATEWAY_TOKEN은 Censorship_Agent/n8n 서버 환경변수로만 관리합니다.
    SAFETY_REVIEW_URL: '',
    RECOMMENDATION_URL: ''
};
