/*
Tác giả script: YuiChy
Nguồn: https://github.com/DecoAri/JavaScript/blob/main/Surge/TF_keys.js
Cách sử dụng cụ thể:
1: Nhập plugin vào
2: Truy cập trang Mitm và bật Mitm over Http2
3: Bật VPN, vào ứng dụng TestFlight, hiển thị thông báo lấy thông tin thành công
4: Đến Cài đặt -> Dữ liệu lưu trữ -> Nhập dữ liệu cụ thể key điền APP_ID, giá trị điền ID TestFlight bạn muốn tham gia, (ID là chuỗi sau "join" trong liên kết https://testflight.apple.com/join/LPQmtkUs (trong ví dụ này là "LPQmtkUs") ⚠️: Hỗ trợ vô số liên kết TF, mỗi liên kết cần phân tách bằng dấu phẩy tiếng Anh "," (ví dụ: LPQmtkUs,Hgun65jg,8yhJgv))

*/

const reg1 = /^https:\/\/testflight\.apple\.com\/v3\/accounts\/(.*)\/apps$/;
const reg2 = /^https:\/\/testflight\.apple\.com\/join\/(.*)/;
if (reg1.test($request.url)) {
    $persistentStore.write(null, 'request_id')
    let url = $request.url
    let key = url.replace(/(.*accounts\/)(.*)(\/apps)/, '$2')
    let session_id = $request.headers['X-Session-Id'] || $request.headers['x-session-id']
    let session_digest = $request.headers['X-Session-Digest'] || $request.headers['x-session-digest']
    let request_id = $request.headers['X-Request-Id'] || $request.headers['x-request-id']
    let ua = $request.headers['User-Agent'] || $request.headers['user-agent']
    $persistentStore.write(key, 'key')
    $persistentStore.write(session_id, 'session_id')
    $persistentStore.write(session_digest, 'session_digest')
    $persistentStore.write(request_id, 'request_id')
    $persistentStore.write(ua, 'tf_ua')
    console.log($request.headers)
    if ($persistentStore.read('request_id') !== null) {
      $notification.post('Thông tin TF đã lấy', 'Lấy thông tin thành công, vui lòng đóng script!','')

    } else {
      $notification.post('Thông tin TF không lấy được','Lấy thông tin không thành công, vui lòng bật Mitm over HTTP2, khởi động lại VPN và ứng dụng TestFlight!','')
    }
    $done({})
}
if (reg2.test($request.url)) {
  let appId = $persistentStore.read("APP_ID");
  if (!appId) {
    appId = "";
  }
  let arr = appId.split(",");
  const id = reg2.exec($request.url)[1];
  arr.push(id);
  arr = unique(arr).filter((a) => a);
  if (arr.length > 0) {
    appId = arr.join(",");
  }
  $persistentStore.write(appId, "APP_ID");
  $notification.post("Tự động tham gia TestFlight", `Đã thêm APP_ID: ${id}`, `ID hiện tại: ${appId}`);
  $done({})
}
function unique(arr) {
  return Array.from(new Set(arr));
}
