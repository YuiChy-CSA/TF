const reg1 = /^https:\/\/testflight\.apple\.com\/v3\/accounts\/(.*)\/apps$/;
const reg2 = /^https:\/\/testflight\.apple\.com\/join\/(.*)/;

if (reg1.test($request.url)) {
    handleAccountAppsRequest($request);
} else if (reg2.test($request.url)) {
    handleJoinRequest($request);
}

function handleAccountAppsRequest(request) {
    $persistentStore.write(null, 'request_id');
    let url = request.url;
    let key = url.replace(/(.*accounts\/)(.*)(\/apps)/, '$2');
    let session_id = request.headers['X-Session-Id'] || request.headers['x-session-id'];
    let session_digest = request.headers['X-Session-Digest'] || request.headers['x-session-digest'];
    let request_id = request.headers['X-Request-Id'] || request.headers['x-request-id'];
    let ua = request.headers['User-Agent'] || request.headers['user-agent'];
    
    $persistentStore.write(key, 'key');
    $persistentStore.write(session_id, 'session_id');
    $persistentStore.write(session_digest, 'session_digest');
    $persistentStore.write(request_id, 'request_id');
    $persistentStore.write(ua, 'tf_ua');
    
    console.log(request.headers);

    if ($persistentStore.read('request_id') !== null) {
        $notification.post('TF thông tin', 'Thu thập thông tin thành công, vui lòng tắt script!', '');
    } else {
        $notification.post('TF thông tin', 'Thu thập thông tin thất bại, vui lòng bật Mitm over HTTP2 và khởi động lại VPN và ứng dụng TestFlight!', '');
    }

    $done({});
}

function handleJoinRequest(request) {
    let appId = $persistentStore.read("APP_ID") || "";
    let arr = appId.split(",");
    const id = reg2.exec(request.url)[1];
    arr.push(id);
    arr = unique(arr).filter((a) => a);
    
    if (arr.length > 0) {
        appId = arr.join(",");
    }
    
    $persistentStore.write(appId, "APP_ID");
    $notification.post("Tự động tham gia TestFlight", `Đã thêm APP_ID: ${id}`, `ID hiện tại: ${appId}`);
    $done({});
}

!(async () => {
    let ids = $persistentStore.read('APP_ID');
    if (ids == null) {
        $notification.post('Chưa thêm TestFlight APP_ID', 'Vui lòng thêm hoặc sử dụng liên kết TestFlight để tự động lấy', '');
    } else if (ids == '') {
        $notification.post('Đã tham gia hết tất cả TestFlight', 'Vui lòng tắt plugin này thủ công', '');
    } else {
        ids = ids.split(',');
        for await (const ID of ids) {
            await autoPost(ID);
        }
    }
    $done();
})();

function autoPost(ID) {
    let Key = $persistentStore.read('key');
    let testurl = 'https://testflight.apple.com/v3/accounts/' + Key + '/ru/';
    let header = {
        'X-Session-Id': `${$persistentStore.read('session_id')}`,
        'X-Session-Digest': `${$persistentStore.read('session_digest')}`,
        'X-Request-Id': `${$persistentStore.read('request_id')}`,
        'User-Agent': `${$persistentStore.read('tf_ua')}`,
    };

    return new Promise(function (resolve) {
        $httpClient.get({ url: testurl + ID, headers: header }, function (error, resp, data) {
            if (error == null) {
                if (resp.status == 404) {
                    let ids = $persistentStore.read('APP_ID').split(',');
                    ids = ids.filter((appId) => appId !== ID);
                    $persistentStore.write(ids.toString(), 'APP_ID');
                    console.log(ID + ' ' + 'Không tồn tại TestFlight này, đã tự động xóa APP_ID này');
                    $notification.post(ID, 'Không tồn tại TestFlight', 'Đã tự động xóa APP_ID này');
                    resolve();
                } else {
                    let jsonData = JSON.parse(data);
                    if (jsonData.data == null) {
                        console.log(ID + ' ' + jsonData.messages[0].message);
                        resolve();
                    } else if (jsonData.data.status == 'FULL') {
                        console.log(jsonData.data.app.name + ' ' + ID + ' ' + jsonData.data.message);
                        resolve();
                    } else {
                        $httpClient.post({ url: testurl + ID + '/accept', headers: header }, function (error, resp, body) {
                            let jsonBody = JSON.parse(body);
                            $notification.post(jsonBody.data.name, 'Tham gia TestFlight thành công', '');
                            console.log(jsonBody.data.name + ' Tham gia TestFlight thành công');
                            let ids = $persistentStore.read('APP_ID').split(',');
                            ids = ids.filter((appId) => appId !== ID);
                            $persistentStore.write(ids.toString(), 'APP_ID');
                            resolve();
                        });
                    }
                }
            } else {
                if (error == 'The request timed out.') {
                    resolve();
                } else {
                    $notification.post('Tự động tham gia TestFlight', error, '');
                    console.log(ID + ' ' + error);
                    resolve();
                }
            }
        });
    });
}

function unique(arr) {
    return Array.from(new Set(arr));
}