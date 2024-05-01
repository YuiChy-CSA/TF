/*
Tác giả Script: Yui Chy
*/

if (typeof $request !== 'undefined' && $request) {
  let url = $request.url;
  const reg1 = /^https:\/\/testflight\.apple\.com\/v3\/accounts\/(.*)\/apps$/;
  const reg2 = /^https:\/\/testflight\.apple\.com\/join\/(.*)/;

  if (reg1.test(url)) {
    $prefs.setValueForKey(null, "request_id");
    let key = url.replace(/(.*accounts\/)(.*)(\/apps)/, "$2");
    const headers = Object.keys($request.headers).reduce((t, i) => ((t[i.toLowerCase()] = $request.headers[i]), t), {});

    let session_id = headers["x-session-id"];
    let session_digest = headers["x-session-digest"];
    let request_id = headers["x-request-id"];
    $prefs.setValueForKey(key, "key");
    $prefs.setValueForKey(session_id, "session_id");
    $prefs.setValueForKey(session_digest, "session_digest");
    $prefs.setValueForKey(request_id, "request_id");
    if ($prefs.valueForKey("request_id") !== null) {
      $notify("TestFlight tự động tham gia", "Lấy thông tin thành công", "");
    } else {
      $notify("TestFlight tự động tham gia", "Lấy thông tin thất bại", "Vui lòng thêm testflight.apple.com");
    }
    $done({});
  } else if (reg2.test(url)) {
    let appId = $prefs.valueForKey("APP_ID") || "";
    let arr = appId.split(",");
    const id = reg2.exec(url)[1];
    arr.push(id);
    arr = unique(arr).filter((a) => a);
    if (arr.length > 0) {
      appId = arr.join(",");
    }
    $prefs.setValueForKey(appId, "APP_ID");
    $notify("TestFlight tự động tham gia", `Đã thêm APP_ID: ${id}`, `ID hiện tại: ${appId}`);
    $done({});
  }
} else {
  console.log("Không có yêu cầu hoặc biến $request không được định nghĩa.");
}

function unique(arr) {
  return Array.from(new Set(arr));
}