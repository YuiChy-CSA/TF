/*
Tác giả Script: Yui Chy
*/

if (typeof $request !== 'undefined' && $request) {
    let url = $request.url;

    const keyPattern = /^https:\/\/testflight\.apple\.com\/v3\/accounts\/(.+?)\/apps$/;
    const joinPattern = /^https:\/\/testflight\.apple\.com\/join\/([A-Za-z0-9]+)$/;
    const ruPattern = /v3\/accounts\/.*\/ru\/(.*)/;

    if (keyPattern.test(url)) {
        // Xử lý khi request URL khớp với keyPattern
        let key = url.match(keyPattern)[1];

        // Lưu các thông tin vào persistent store
        let headers = Object.fromEntries(Object.entries($request.headers).map(([key, value]) => [key.toLowerCase(), value]));
        $persistentStore.write(headers['x-session-id'], 'session_id');
        $persistentStore.write(headers['x-session-digest'], 'session_digest');
        $persistentStore.write(headers['x-request-id'], 'request_id');
        $persistentStore.write(key, 'key');

        // Thông báo thành công nếu chưa có APP_ID
        let existingAppIds = $persistentStore.read('APP_ID');
        if (!existingAppIds) {
            $notification.post('Lấy thông tin thành công 🎉', '', 'Vui lòng lấy APP_ID trước khi chỉnh sửa tham số module để ngừng việc chạy script này', {"auto-dismiss": 10});
        }
        console.log(`Lấy thông tin thành công: session_id=${headers['x-session-id']}, session_digest=${headers['x-session-digest']}, request_id=${headers['x-request-id']}, key=${key}`);
    } else if (joinPattern.test(url)) {
        // Xử lý khi request URL khớp với joinPattern
        const id = url.match(joinPattern)[1];
        handler(id);
    } else if (ruPattern.test(url)) {
        // Xử lý khi request URL khớp với ruPattern
        const id = url.match(ruPattern)[1];
        handler(id);
    }

    $done({});
} else {
    // Xử lý khi không có $request (chạy bất đồng bộ)
    (async () => {
        let ids = $persistentStore.read('APP_ID');
        if (!ids) {
            console.log('Không tìm thấy APP_ID');
            $done();
        } else {
            ids = ids.split(',');
            for (const ID of ids) {
                await autoPost(ID, ids);
            }
            if (ids.length === 0) {
                $notification.post('Tất cả TestFlight đã tham gia 🎉', '', 'Module đã tự động đóng lại', {"sound": true});
                $done($httpAPI('POST', '/v1/modules', {'Public Monitoring': false}));
            } else {
                $done();
            }
        }
    })();
}

async function handler(appId) {
    let existingAppIds = $persistentStore.read('APP_ID');
    let appIdSet = new Set(existingAppIds ? existingAppIds.split(',') : []);
    
    if (!appIdSet.has(appId)) {
        appIdSet.add(appId);
        $persistentStore.write(Array.from(appIdSet).join(','), 'APP_ID');
        $notification.post('Đã ghi nhận APP_ID', '', `Đã ghi nhận và lưu trữ APP_ID: ${appId}`, {"auto-dismiss": 2});
        console.log(`Đã ghi nhận và lưu trữ APP_ID: ${appId}`);
    } else {
        $notification.post('Trùng lặp APP_ID', '', `APP_ID: ${appId} đã tồn tại, không cần thêm lại.`, {"auto-dismiss": 2});
        console.log(`APP_ID: ${appId} đã tồn tại, không cần thêm lại.`);
    }
}

async function autoPost(ID, ids) {
    let key = $persistentStore.read('key');
    let testurl = `https://testflight.apple.com/v3/accounts/${key}/ru/${ID}`;
    let headers = {
        'X-Session-Id': $persistentStore.read('session_id'),
        'X-Session-Digest': $persistentStore.read('session_digest'),
        'X-Request-Id': $persistentStore.read('request_id')
    };

    $httpClient.get({ url: testurl, headers: headers }, (error, response, data) => {
        if (error) {
            console.log(`${ID} Yêu cầu mạng thất bại: ${error}，giữ lại APP_ID`);
            return;
        }

        if (response.status !== 200) {
            console.log(`${ID} Không phải liên kết hợp lệ: mã trạng thái ${response.status}，xóa bỏ APP_ID`);
            ids.splice(ids.indexOf(ID), 1);
            $persistentStore.write(ids.join(','), 'APP_ID');
            $notification.post('Không phải liên kết TestFlight hợp lệ', '', `${ID} đã bị xóa bỏ`, {"auto-dismiss": 2});
            return;
        }

        let jsonData;
        try {
            jsonData = JSON.parse(data);
        } catch (parseError) {
            console.log(`${ID} Lỗi phân tích cú pháp phản hồi: ${parseError}，giữ lại APP_ID`);
            return;
        }

        if (!jsonData || !jsonData.data) {
            console.log(`${ID} Không thể chấp nhận lời mời, giữ lại APP_ID`);
            return;
        }

        if (jsonData.data.status === 'FULL') {
            console.log(`${ID} Đã đầy thử nghiệm, giữ lại APP_ID`);
            return;
        }

        $httpClient.post({ url: `${testurl}/accept`, headers: headers }, (error, response, body) => {
            if (!error && response.status === 200) {
                let jsonBody;
                try {
                    jsonBody = JSON.parse(body);
                } catch (parseError) {
                    console.log(`${ID} Yêu cầu tham gia phản hồi phân tích cú pháp lỗi: ${parseError}，giữ lại APP_ID`);
                    return;
                }

                console.log(`${jsonBody.data.name} Đã tham gia TestFlight thành công`);
                ids.splice(ids.indexOf(ID), 1);
                $persistentStore.write(ids.join(','), 'APP_ID');
                if (ids.length > 0) {
                    $notification.post(`${jsonBody.data.name} Đã tham gia TestFlight thành công`, '', `Tiếp tục với APP ID: ${ids.join(',')}`, {"sound": true});
                } else {
                    $notification.post(`${jsonBody.data.name} Đã tham gia TestFlight thành công`, '', 'Đã xử lý tất cả APP ID', {"sound": true});
                }
            } else {
                console.log(`${ID} Tham gia không thành công: ${error || `Mã trạng thái ${response.status}`}，giữ lại APP_ID`);
            }
        });
    });
}
