/*
Tác giả Script: Yui Chy
*/

if (typeof $request !== 'undefined' && $request) {
    let url = $request.url

    let keyPattern = /^https:\/\/testflight\.apple\.com\/v3\/accounts\/(.*?)\/apps/
    let key = url.match(keyPattern) ? url.match(keyPattern)[1] : null
    const handler = (appIdMatch) => {
        if (appIdMatch && appIdMatch[1]) {
            let appId = appIdMatch[1]
            let existingAppIds = $persistentStore.read('APP_ID')
            let appIdSet = new Set(existingAppIds ? existingAppIds.split(',') : [])
            if (!appIdSet.has(appId)) {
                appIdSet.add(appId)
                $persistentStore.write(Array.from(appIdSet).join(','), 'APP_ID')
                $notification.post('Đã ghi nhận APP_ID', '', `Đã ghi nhận và lưu trữ APP_ID: ${appId}`, {"auto-dismiss": 2})
                console.log(`Đã ghi nhận và lưu trữ APP_ID: ${appId}`)
            } else {
                $notification.post('Trùng lặp APP_ID', '', `APP_ID: ${appId} đã tồn tại, không cần thêm lại.` , {"auto-dismiss": 2})
                console.log(`APP_ID: ${appId} đã tồn tại, không cần thêm lại.`)
            }
        } else {
            console.log('Không tìm thấy TestFlight APP_ID hợp lệ')
        }
    }
    if (/^https:\/\/testflight\.apple\.com\/v3\/accounts\/.*\/apps$/.test(url) && key) {
        let headers = Object.fromEntries(Object.entries($request.headers).map(([key, value]) => [key.toLowerCase(), value]))
        let session_id = headers['x-session-id']
        let session_digest = headers['x-session-digest']
        let request_id = headers['x-request-id']

        $persistentStore.write(session_id, 'session_id')
        $persistentStore.write(session_digest, 'session_digest')
        $persistentStore.write(request_id, 'request_id')
        $persistentStore.write(key, 'key')

        let existingAppIds = $persistentStore.read('APP_ID')
        if (!existingAppIds) {
            $notification.post('Lấy thông tin thành công 🎉', '', 'Vui lòng lấy APP_ID trước khi chỉnh sửa tham số module để ngừng việc chạy script này' , {"auto-dismiss": 10})
        }
        console.log(`Lấy thông tin thành công: session_id=${session_id}, session_digest=${session_digest}, request_id=${request_id}, key=${key}`)
    } else if (/^https:\/\/testflight\.apple\.com\/join\/([A-Za-z0-9]+)$/.test(url)) {
        const appIdMatch = url.match(/^https:\/\/testflight\.apple\.com\/join\/([A-Za-z0-9]+)$/)
        handler(appIdMatch)
    } else if (/v3\/accounts\/.*\/ru/.test(url)) {
        const appIdMatch = url.match(/v3\/accounts\/.*\/ru\/(.*)/)
        handler(appIdMatch)
    }

    $done({})
} else {
    !(async () => {
        let ids = $persistentStore.read('APP_ID')
        if (!ids) {
            console.log('Không tìm thấy APP_ID')
            $done()
        } else {
            ids = ids.split(',')
            for await (const ID of ids) {
                await autoPost(ID, ids)
            }
            if (ids.length === 0) {
                $notification.post('Tất cả TestFlight đã tham gia 🎉', '', 'Module đã tự động đóng lại', {"sound": true});
                $done($httpAPI('POST', '/v1/modules', {'Public Monitoring': false}));
            } else {
                $done()
            }
        }
    })()
}

async function autoPost(ID, ids) {
    let Key = $persistentStore.read('key')
    let testurl = `https://testflight.apple.com/v3/accounts/${Key}/ru/`
    let header = {
        'X-Session-Id': $persistentStore.read('session_id'),
        'X-Session-Digest': $persistentStore.read('session_digest'),
        'X-Request-Id': $persistentStore.read('request_id')
    }

    return new Promise((resolve) => {
        $httpClient.get({ url: testurl + ID, headers: header }, (error, response, data) => {
            if (error) {
                console.log(`${ID} Yêu cầu mạng thất bại: ${error}，giữ lại APP_ID`);
                resolve();
                return;
            }

            if (response.status === 500) {
                console.log(`${ID} Lỗi máy chủ, mã trạng thái 500，giữ lại APP_ID`);
                resolve();
                return
            }

            if (response.status !== 200) {
                console.log(`${ID} Không phải liên kết hợp lệ: mã trạng thái ${response.status}，xóa bỏ APP_ID`)
                ids.splice(ids.indexOf(ID), 1)
                $persistentStore.write(ids.join(','), 'APP_ID')
                $notification.post('Không phải liên kết TestFlight hợp lệ', '', `${ID} đã bị xóa bỏ` , {"auto-dismiss": 2})
                resolve()
                return
            }

            let jsonData
            try {
                jsonData = JSON.parse(data)
            } catch (parseError) {
                console.log(`${ID} Lỗi phân tích cú pháp phản hồi: ${parseError}，giữ lại APP_ID`)
                resolve()
                return
            }

            if (!jsonData || !jsonData.data) {
                console.log(`${ID} Không thể chấp nhận lời mời, giữ lại APP_ID`)
                resolve()
                return
            }

            if (jsonData.data.status === 'FULL') {
                console.log(`${ID} Đã đầy thử nghiệm, giữ lại APP_ID`)
                resolve()
                return
            }

            $httpClient.post({ url: testurl + ID + '/accept', headers: header }, (error, response, body) => {
                if (!error && response.status === 200) {
                    let jsonBody
                    try {
                        jsonBody = JSON.parse(body)
                    } catch (parseError) {
                        console.log(`${ID} Yêu cầu tham gia phản hồi phân tích cú pháp lỗi: ${parseError}，giữ lại APP_ID`)
                        resolve()
                        return
                    }

                    console.log(`${jsonBody.data.name} Đã tham gia TestFlight thành công`)
                    ids.splice(ids.indexOf(ID), 1)
                    $persistentStore.write(ids.join(','), 'APP_ID')
                    if (ids.length > 0) {
                        $notification.post(jsonBody.data.name + ' Đã tham gia TestFlight thành công', '', `Tiếp tục với APP ID: ${ids.join(',')}`, {"sound": true})
                    } else {
                        $notification.post(jsonBody.data.name + ' Đã tham gia TestFlight thành công', '', 'Đã xử lý tất cả APP ID', {"sound": true})
                    }
                } else {
                    console.log(`${ID} Tham gia không thành công: ${error || `Mã trạng thái ${response.status}`}，giữ lại APP_ID`)
                }
                resolve()
            })
        })
    })
}