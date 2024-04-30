/*
Script Author: Yui Chy
*/

// Định nghĩa biểu thức chính quy cho các địa chỉ URL của TestFlight
const reg1 = /^https:\/\/testflight\.apple\.com\/v3\/accounts\/.*\/apps$/;
const reg2 = /^https:\/\/testflight\.apple\.com\/join\/(.*)/;

// Hàm xử lý yêu cầu HTTP
$loonRespond({
    matches: [reg1, reg2], // Xác định các địa chỉ URL cần xử lý
    handler: async (request, response) => {
        // Lấy thông tin từ yêu cầu HTTP
        const url = request.url;
        const method = request.method;
        const headers = request.headers;

        if (method === 'GET') {
            // Xử lý yêu cầu nếu địa chỉ URL khớp với reg1
            if (reg1.test(url)) {
                const key = url.match(/accounts\/([^\/]+)\/apps/)[1];
                const session_id = headers['X-Session-Id'] || headers['x-session-id'];
                const session_digest = headers['X-Session-Digest'] || headers['x-session-digest'];
                const request_id = headers['X-Request-Id'] || headers['x-request-id'];
                const ua = headers['User-Agent'] || headers['user-agent'];

                // Lưu trữ thông tin vào persistent store của Loon
                $persistentStore.write(key, 'key');
                $persistentStore.write(session_id, 'session_id');
                $persistentStore.write(session_digest, 'session_digest');
                $persistentStore.write(request_id, 'request_id');
                $persistentStore.write(ua, 'tf_ua');

                // Kết thúc xử lý yêu cầu
                response.complete();
            }

            // Xử lý yêu cầu nếu địa chỉ URL khớp với reg2
            if (reg2.test(url)) {
                const id = reg2.exec(url)[1];
                let appId = $persistentStore.read("APP_ID") || "";
                let arr = appId.split(",");
                arr.push(id);
                appId = [...new Set(arr.filter(Boolean))].join(",");
                $persistentStore.write(appId, "APP_ID");
                
                // Kết thúc xử lý yêu cầu
                response.complete();
            }
        }
    }
});
