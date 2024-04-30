/*
Tác giả script: YuiChy
MOD từ Quanx
*/

const TESTFLIGHT_APPS_URL_PATTERN = /^https:\/\/testflight\.apple\.com\/v3\/accounts\/(.*?)\/apps/;
const JOIN_APP_URL_PATTERN = /^https:\/\/testflight\.apple\.com\/join\/([A-Za-z0-9]+)$/;
const RU_APP_URL_PATTERN = /v3\/accounts\/.*\/ru\/(.*)/;

function getKeyFromUrl(url, keyPattern) {
    const match = url.match(keyPattern);
    return match ? match[1] : null;
}

function handleAPP_ID(APP_ID) {
    if (!APP_ID) {
        console.log('Không bắt được APP_ID hợp lệ');
        return;
    }

    const existingAPP_IDs = $persistentStore.read('APP_ID') || '';
    const APP_IDSet = new Set(existingAPP_IDs.split(','));

    if (!APP_IDSet.has(APP_ID)) {
        APP_IDSet.add(APP_ID);
        $persistentStore.write(Array.from(APP_IDSet).join(','), 'APP_ID');
        $notification.post('Đã bắt được APP_ID', '', `Đã bắt và lưu trữ APP_ID: ${APP_ID}`, {"auto-dismiss": 2});
        console.log(`Đã bắt và lưu trữ APP_ID: ${APP_ID}`);
    } else {
        $notification.post('APP_ID trùng lặp', '', `APP_ID: ${APP_ID} đã tồn tại, không cần thêm lại.`, {"auto-dismiss": 2});
        console.log(`APP_ID: ${APP_ID} đã tồn tại, không cần thêm lại.`);
    }
}

async function autoPost(ID, ids) {
    const key = $persistentStore.read('key');
    const header = {
        'X-Session-Id': $persistentStore.read('session_id'),
        'X-Session-Digest': $persistentStore.read('session_digest'),
        'X-Request-Id': $persistentStore.read('request_id')
    };

    function handleError(ID, message) {
        console.log(`${ID} ${message}, giữ lại APP_ID`);
    }

    const testUrl = `https://testflight.apple.com/v3/accounts/${key}/ru/`;

    try {
        const response = await $httpClient.get({ url: testUrl + ID, headers: header });
        
        if (response.status !== 200) {
            ids.splice(ids.indexOf(ID), 1);
            $persistentStore.write(ids.join(','), 'APP_ID');
            $notification.post('Không phải liên kết TestFlight hợp lệ', '', `${ID} đã bị loại bỏ`, {"auto-dismiss": 2});
            return;
        }

        const jsonData = JSON.parse(response.body);
        if (!jsonData || !jsonData.data) {
            handleError(ID, 'Không thể chấp nhận lời mời');
            return;
        }

        if (jsonData.data.status === 'FULL') {
            handleError(ID, 'Thử nghiệm đã đầy');
            return;
        }

        const acceptResponse = await $httpClient.post({ url: testUrl + ID + '/accept', headers: header });
        if (acceptResponse.status === 200) {
            ids.splice(ids.indexOf(ID), 1);
            $persistentStore.write(ids.join(','), 'APP_ID');
            const notificationMsg = ids.length > 0 ? `Tiếp tục thực hiện APP ID: ${ids.join(',')}` : 'Đã xử lý tất cả APP ID';
            $notification.post(`${jsonData.data.name} TestFlight đã tham gia thành công`, '', notificationMsg, {"sound": true});
        } else {
            handleError(ID, `Tham gia không thành công: Mã trạng thái ${acceptResponse.status}`);
        }
    } catch (error) {
        handleError(ID, `Lỗi yêu cầu mạng: ${error}`);
    }
}

if (typeof $request !== 'undefined' && $request) {
    const url = $request.url;

    if (TESTFLIGHT_APPS_URL_PATTERN.test(url)) {
        const key = getKeyFromUrl(url, TESTFLIGHT_APPS_URL_PATTERN);
        if (key) {
            const headers = Object.fromEntries(Object.entries($request.headers).map(([key, value]) => [key.toLowerCase(), value]));
            $persistentStore.write(headers['x-session-id'], 'session_id');
            $persistentStore.write(headers['x-session-digest'], 'session_digest');
            $persistentStore.write(headers['x-request-id'], 'request_id');
            $persistentStore.write(key, 'key');
            console.log(`Thông tin thu thập thành công: session_id=${headers['x-session-id']}, session_digest=${headers['x-session-digest']}, request_id=${headers['x-request-id']}, key=${key}`);
        }
    } else if (JOIN_APP_URL_PATTERN.test(url)) {
        const APP_ID = url.match(JOIN_APP_URL_PATTERN)[1];
        handleAPP_ID(APP_ID);
    } else if (RU_APP_URL_PATTERN.test(url)) {
        const APP_ID = url.match(RU_APP_URL_PATTERN)[1];
        handleAPP_ID(APP_ID);
    }

    $done({});
} else {
    (async () => {
        const ids = $persistentStore.read('APP_ID');
        if (!ids) {
            console.log('Không phát hiện được APP_ID');
            $done();
            return;
        }

        try {
            const APP_IDs = ids.split(',');
            for (const ID of APP_IDs) {
                await autoPost(ID, APP_IDs);
            }

            if (APP_IDs.length === 0) {
                $notification.post('Tất cả TestFlight đã được thêm 🎉', '', 'Mô-đun đã tự động tắt', {"sound": true});
                $done($httpAPI('POST', '/v1/modules', {'Giám sát thử nghiệm công cộng': false}));
            } else {
                $done();
            }
        } catch (error) {
            console.log(`Lỗi xử lý APP_ID: ${error}`);
            $done();
        }
    })();
}
