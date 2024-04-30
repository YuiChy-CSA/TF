/*
Script Author: Yui Chy
*/

const reg1 = /^https:\/\/testflight\.apple\.com\/v3\/accounts\/(.*)\/apps$/;
const reg2 = /^https:\/\/testflight\.apple\.com\/join\/(.*)/;

if (reg1.test($request.url)) {
    const url = $request.url;
    const key = url.match(/accounts\/([^\/]+)\/apps/)[1];
    const session_id = $request.headers['X-Session-Id'] || $request.headers['x-session-id'];
    const session_digest = $request.headers['X-Session-Digest'] || $request.headers['x-session-digest'];
    const request_id = $request.headers['X-Request-Id'] || $request.headers['x-request-id'];
    const ua = $request.headers['User-Agent'] || $request.headers['user-agent'];

    $persistentStore.write(key, 'key');
    $persistentStore.write(session_id, 'session_id');
    $persistentStore.write(session_digest, 'session_digest');
    $persistentStore.write(request_id, 'request_id');
    $persistentStore.write(ua, 'tf_ua');

    if ($persistentStore.read('request_id') !== null) {
        $notification.post('TF thông tin', 'Thu thập thông tin thành công, vui lòng tắt script!', '');
    } else {
        $notification.post('TF thông tin', 'Thu thập thông tin thất bại, vui lòng bật Mitm over HTTP2 và khởi động lại VPN và ứng dụng TestFlight!', '');
    }

    $done({});
}

if (reg2.test($request.url)) {
    const id = reg2.exec($request.url)[1];
    let appId = $persistentStore.read("APP_ID") || "";
    let arr = appId.split(",");
    arr.push(id);
    appId = [...new Set(arr.filter(Boolean))].join(",");
    $persistentStore.write(appId, "APP_ID");
    $notification.post("Tự động tham gia TestFlight", `Đã thêm APP_ID: ${id}`, `ID hiện tại: ${appId}`);
    $done({});
}