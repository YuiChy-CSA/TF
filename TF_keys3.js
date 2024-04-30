/*
Admin: YuiChy
*/

if ($request) {
    let url = $request.url;

    let keyPattern = /^https:\/\/testflight\.apple\.com\/v3\/accounts\/(.*?)\/apps/;
    let key = url.match(keyPattern) ? url.match(keyPattern)[1] : null;

    const handler = (appIdMatch) => {
        if (appIdMatch && appIdMatch[1]) {
            let appId = appIdMatch[1];
            let existingAppIds = $persistentStore.read('APP_ID');
            let appIdSet = new Set(existingAppIds ? existingAppIds.split(',') : []);
            if (!appIdSet.has(appId)) {
                appIdSet.add(appId);
                $persistentStore.write(Array.from(appIdSet).join(','), 'APP_ID');
                $notification.post('Đã lưu APP_ID', '', `Đã lưu trữ APP_ID: ${appId}`, {"sound": "default"});
                console.log(`Đã lưu trữ APP_ID: ${appId}`);
            } else {
                $notification.post('APP_ID đã tồn tại', '', `APP_ID: ${appId} đã tồn tại, không cần thêm lại.`, {"sound": "default"});
                console.log(`APP_ID: ${appId} đã tồn tại, không cần thêm lại.`);
            }
        } else {
            console.log('Không tìm thấy TestFlight APP_ID hợp lệ');
        }
    };

    if (/^https:\/\/testflight\.apple\.com\/v3\/accounts\/.*\/apps$/.test(url) && key) {
        let headers = $request.headers;
        let session_id = headers['X-Session-Id'];
        let session_digest = headers['X-Session-Digest'];
        let request_id = headers['X-Request-Id'];

        if (session_id && session_digest && request_id) {
            $persistentStore.write(session_id, 'session_id');
            $persistentStore.write(session_digest, 'session_digest');
            $persistentStore.write(request_id, 'request_id');
            $persistentStore.write(key, 'key');

            let existingAppIds = $persistentStore.read('APP_ID');
            if (!existingAppIds) {
                $notification.post('Thông tin lấy thành công 🎉', '', 'Vui lòng lấy APP_ID để chỉnh sửa tham số mô-đun và tắt script này', {"sound": "default"});
            }
            console.log(`Thông tin lấy thành công: session_id=${session_id}, session_digest=${session_digest}, request_id=${request_id}, key=${key}`);
        } else {
            console.log('Thông tin không hợp lệ từ yêu cầu');
        }
    } else if (/^https:\/\/testflight\.apple\.com\/join\/([A-Za-z0-9]+)$/.test(url)) {
        const appIdMatch = url.match(/^https:\/\/testflight\.apple\.com\/join\/([A-Za-z0-9]+)$/);
        handler(appIdMatch);
    } else if (/v3\/accounts\/.*\/ru/.test(url)) {
        const appIdMatch = url.match(/v3\/accounts\/.*\/ru\/(.*)/);
        handler(appIdMatch);
    }

    $done({});
} else {
    let ids = $persistentStore.read('APP_ID');
    if (!ids) {
        console.log('Không tìm thấy APP_ID');
        $done();
    } else {
        ids = ids.split(',');
        (async () => {
            for (const ID of ids) {
                await autoPost(ID, ids);
            }
            if (ids.length === 0) {
                $notification.post('Tất cả TestFlight đã được thêm 🎉', '', 'Mô-đun đã tự động tắt', {"sound": "default"});
                $done($http.post('http://localhost:6171/v1/modules', {'Giám sát thử nghiệm công cộng': false}));
            } else {
                $done();
            }
        })();
    }
}

async function autoPost(ID, ids) {
    let Key = $persistentStore.read('key');
    let testurl = `https://testflight.apple.com/v3/accounts/${Key}/ru/`;
    let header = {
        'X-Session-Id': $persistentStore.read('session_id'),
        'X-Session-Digest': $persistentStore.read('session_digest'),
        'X-Request-Id': $persistentStore.read('request_id')
    };

    try {
        const response = await $httpClient.get({ url: testurl + ID, headers: header });
        const data = response.data;
        
        if (!data) {
            console.log(`${ID} Không thể chấp nhận lời mời, giữ lại APP_ID`);
            return;
        }

        if (data.status === 'FULL') {
            console.log(`${ID} Thử nghiệm đã đầy, giữ lại APP_ID`);
            return;
        }

        const acceptResponse = await $httpClient.post({ url: testurl + ID + '/accept', headers: header });
        const acceptData = acceptResponse.data;

        if (acceptData) {
            console.log(`${acceptData.data.name} Tham gia TestFlight thành công`);
            $notify(acceptData.data.name, "Tham gia TestFlight thành công", "");
        }

        ids.splice(ids.indexOf(ID), 1);
        $persistentStore.write(ids.join(','), 'APP_ID');
        if (ids.length > 0) {
            $notification.post(`${acceptData.data.name} Tham gia TestFlight thành công`, '', `Tiếp tục xử lý APP ID: ${ids.join(',')}`, {"sound": "default"});
        } else {
            $notification.post(`${acceptData.data.name} Tham gia TestFlight thành công`, '', 'Đã xử lý tất cả APP ID', {"sound": "default"});
        }
    } catch (error) {
        console.log(`${ID} Lỗi trong quá trình xử lý: ${error}`);
    }
}