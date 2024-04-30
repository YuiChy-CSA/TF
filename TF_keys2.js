/*
Tác giả script: YuiChy
MOD từ Quanx
*/

if (typeof $request !== 'undefined' && $request) {
    let url = $request.url;

    const getKeyFromUrl = (url, keyPattern) => {
        const match = url.match(keyPattern);
        return match ? match[1] : null;
    };

    const handleAppId = (appIdMatch) => {
        if (!appIdMatch || !appIdMatch[1]) {
            console.log('Không bắt được APP_ID hợp lệ');
            return;
        }
        
        const appId = appIdMatch[1];
        let existingAppIds = $persistentStore.read('APP_ID') || '';
        let appIdSet = new Set(existingAppIds.split(','));

        if (!appIdSet.has(appId)) {
            appIdSet.add(appId);
            $persistentStore.write(Array.from(appIdSet).join(','), 'APP_ID');
            $notification.post('Đã bắt được APP_ID', '', `Đã bắt và lưu trữ APP_ID: ${appId}`, {"auto-dismiss": 2});
            console.log(`Đã bắt và lưu trữ APP_ID: ${appId}`);
        } else {
            $notification.post('APP_ID trùng lặp', '', `APP_ID: ${appId} đã tồn tại, không cần thêm lại.`, {"auto-dismiss": 2});
            console.log(`APP_ID: ${appId} đã tồn tại, không cần thêm lại.`);
        }
    };

    if (/^https:\/\/testflight\.apple\.com\/v3\/accounts\/.*\/apps$/.test(url)) {
        let keyPattern = /^https:\/\/testflight\.apple\.com\/v3\/accounts\/(.*?)\/apps/;
        let key = getKeyFromUrl(url, keyPattern);
        if (key) {
            const headers = Object.fromEntries(Object.entries($request.headers).map(([key, value]) => [key.toLowerCase(), value]));
            $persistentStore.write(headers['x-session-id'], 'session_id');
            $persistentStore.write(headers['x-session-digest'], 'session_digest');
            $persistentStore.write(headers['x-request-id'], 'request_id');
            $persistentStore.write(key, 'key');
            console.log(`Thông tin thu thập thành công: session_id=${headers['x-session-id']}, session_digest=${headers['x-session-digest']}, request_id=${headers['x-request-id']}, key=${key}`);
        }
    } else if (/^https:\/\/testflight\.apple\.com\/join\/([A-Za-z0-9]+)$/.test(url)) {
        handleAppId(url.match(/^https:\/\/testflight\.apple\.com\/join\/([A-Za-z0-9]+)$/));
    } else if (/v3\/accounts\/.*\/ru/.test(url)) {
        handleAppId(url.match(/v3\/accounts\/.*\/ru\/(.*)/));
    }

    $done({});
} else {
    (async () => {
        let ids = $persistentStore.read('APP_ID');
        if (!ids) {
            console.log('Không phát hiện được APP_ID');
            $done();
            return;
        }

        ids = ids.split(',');
        for (const ID of ids) {
            await autoPost(ID, ids);
        }

        if (ids.length === 0) {
            $notification.post('Tất cả TestFlight đã được thêm 🎉', '', 'Mô-đun đã tự động tắt', {"sound": true});
            $done($httpAPI('POST', '/v1/modules', {'Giám sát thử nghiệm công cộng': false}));
        } else {
            $done();
        }
    })();
}

async function autoPost(ID, ids) {
    const key = $persistentStore.read('key');
    const header = {
        'X-Session-Id': $persistentStore.read('session_id'),
        'X-Session-Digest': $persistentStore.read('session_digest'),
        'X-Request-Id': $persistentStore.read('request_id')
    };

    const handleError = (ID, message) => {
        console.log(`${ID} ${message}, giữ lại APP_ID`);
        return;
    };

    const testUrl = `https://testflight.apple.com/v3/accounts/${key}/ru/`;

    return new Promise((resolve) => {
        $httpClient.get({ url: testUrl + ID, headers: header }, (error, response, data) => {
            if (error) {
                resolve(handleError(ID, `Lỗi yêu cầu mạng: ${error}`));
                return;
            }

            if (response.status === 500) {
                resolve(handleError(ID, 'Lỗi máy chủ, mã trạng thái 500'));
                return;
            }

            if (response.status !== 200) {
                ids.splice(ids.indexOf(ID), 1);
                $persistentStore.write(ids.join(','), 'APP_ID');
                $notification.post('Không phải liên kết TestFlight hợp lệ', '', `${ID} đã bị loại bỏ`, {"auto-dismiss": 2});
                resolve();
                return;
            }

            let jsonData;
            try {
                jsonData = JSON.parse(data);
            } catch (parseError) {
                resolve(handleError(ID, `Lỗi phân tích cú pháp phản hồi: ${parseError}`));
                return;
            }

            if (!jsonData || !jsonData.data) {
                resolve(handleError(ID, 'Không thể chấp nhận lời mời'));
                return;
            }

            if (jsonData.data.status === 'FULL') {
                resolve(handleError(ID, 'Thử nghiệm đã đầy'));
                return;
            }

            $httpClient.post({ url: testUrl + ID + '/accept', headers: header }, (error, response, body) => {
                if (!error && response.status === 200) {
                    ids.splice(ids.indexOf(ID), 1);
                    $persistentStore.write(ids.join(','), 'APP_ID');
                    const notificationMsg = ids.length > 0 ? `Tiếp tục thực hiện APP ID: ${ids.join(',')}` : 'Đã xử lý tất cả APP ID';
                    $notification.post(`${jsonData.data.name} TestFlight đã tham gia thành công`, '', notificationMsg, {"sound": true});
                } else {
                    resolve(handleError(ID, `Tham gia không thành công: ${error || `Mã trạng thái ${response.status}`}`));
                }
                resolve();
            });
        });
    });
}
