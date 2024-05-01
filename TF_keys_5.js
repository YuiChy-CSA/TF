/*
Tác giả Script: Yui Chy
*/

const url = request.url;

const reg1 = /^https:\/\/testflight\.apple\.com\/v3\/accounts\/(.*)\/apps$/;
const reg2 = /^https:\/\/testflight\.apple\.com\/join\/(.*)/;

if (reg1.test(url)) {
    storage.put('key', null);
    const key = url.replace(/(.*accounts\/)(.*)(\/apps)/, '$2');
    const session_id = request.headers['X-Session-Id'] || request.headers['x-session-id'];
    const session_digest = request.headers['X-Session-Digest'] || request.headers['x-session-digest'];
    const request_id = request.headers['X-Request-Id'] || request.headers['x-request-id'];
    const ua = request.headers['User-Agent'] || request.headers['user-agent'];
    
    storage.put('key', key);
    storage.put('session_id', session_id);
    storage.put('session_digest', session_digest);
    storage.put('request_id', request_id);
    storage.put('tf_ua', ua);

    console.log(request.headers);

    if (storage.get('request_id') !== null) {
        console.log('Thu thập thông tin thành công, vui lòng tắt script!');
    } else {
        console.log('Thu thập thông tin thất bại, vui lòng bật Mitm over HTTP2 và khởi động lại VPN và ứng dụng TestFlight!');
    }
}

if (reg2.test(url)) {
    let appId = storage.get("APP_ID") || "";
    let arr = appId.split(",");
    const id = reg2.exec(url)[1];
    arr.push(id);
    const uniqueArr = Array.from(new Set(arr));
    const filteredArr = uniqueArr.filter((a) => a);
    
    if (filteredArr.length > 0) {
        appId = filteredArr.join(",");
    }
    
    storage.put("APP_ID", appId);
    console.log(`Đã thêm APP_ID: ${id}`);
}
