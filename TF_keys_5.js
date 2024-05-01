/*
Tác giả Script: Yui Chy
*/

// Lấy thông tin từ URL của HTTP request trong Loon
const url = $request.url;

const reg1 = /^https:\/\/testflight\.apple\.com\/v3\/accounts\/(.*)\/apps$/;
const reg2 = /^https:\/\/testflight\.apple\.com\/join\/(.*)/;

if (reg1.test(url)) {
    // Lưu trữ các giá trị vào Local Storage của Loon
    $persistentStore.write(null, 'key'); // Xóa key cũ
    const key = url.match(reg1)[1]; // Lấy giá trị từ URL
    const session_id = $request.headers['X-Session-Id'] || $request.headers['x-session-id'];
    const session_digest = $request.headers['X-Session-Digest'] || $request.headers['x-session-digest'];
    const request_id = $request.headers['X-Request-Id'] || $request.headers['x-request-id'];
    const ua = $request.headers['User-Agent'] || $request.headers['user-agent'];
    
    $persistentStore.write(key, 'key');
    $persistentStore.write(session_id, 'session_id');
    $persistentStore.write(session_digest, 'session_digest');
    $persistentStore.write(request_id, 'request_id');
    $persistentStore.write(ua, 'tf_ua');

    // Log thông tin headers
    console.log($request.headers);

    if ($persistentStore.read('request_id') !== null) {
        console.log('Thu thập thông tin thành công, vui lòng tắt script!');
    } else {
        console.log('Thu thập thông tin thất bại, vui lòng bật Mitm over HTTP2 và khởi động lại VPN và ứng dụng TestFlight!');
    }
}

if (reg2.test(url)) {
    let appId = $persistentStore.read("APP_ID") || "";
    let arr = appId.split(",");
    const id = url.match(reg2)[1]; // Lấy id từ URL
    arr.push(id);
    const uniqueArr = [...new Set(arr)]; // Loại bỏ các phần tử trùng lặp
    const filteredArr = uniqueArr.filter((a) => a);
    
    if (filteredArr.length > 0) {
        appId = filteredArr.join(",");
    }
    
    $persistentStore.write(appId, "APP_ID");
    console.log(`Đã thêm APP_ID: ${id}`);
}
