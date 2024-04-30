/*
Admin: YuiChy
*/

if (typeof $request !== 'undefined' && $request) {
    let url = $request.url

    // Xác định và trích xuất key từ URL
    let keyPattern = /^https:\/\/testflight\.apple\.com\/v3\/accounts\/(.*?)\/apps/
    let key = url.match(keyPattern) ? url.match(keyPattern)[1] : null

    // Hàm xử lý khi có tìm thấy appId từ URL
    const handler = (appIdMatch) => {
        if (appIdMatch && appIdMatch[1]) {
            let appId = appIdMatch[1]

            // Đọc danh sách các appId đã lưu
            let existingAppIds = $persistentStore.read('APP_ID')
            let appIdSet = new Set(existingAppIds ? existingAppIds.split(',') : [])

            // Kiểm tra xem appId đã tồn tại chưa, nếu chưa thì thêm vào danh sách và lưu lại
            if (!appIdSet.has(appId)) {
                appIdSet.add(appId)
                $persistentStore.write(Array.from(appIdSet).join(','), 'APP_ID')
                $notification.post('Đã lưu APP_ID', '', `Đã lưu APP_ID: ${appId}`, {"auto-dismiss": 2})
                console.log(`Đã lưu APP_ID: ${appId}`)
            } else {
                $notification.post('APP_ID đã tồn tại', '', `APP_ID: ${appId} đã tồn tại, không cần thêm lại.` , {"auto-dismiss": 2})
                console.log(`APP_ID: ${appId} đã tồn tại, không cần thêm lại.`)
            }
        } else {
            console.log('Không tìm thấy TestFlight APP_ID hợp lệ')
        }
    }

    // Xử lý khi URL là danh sách ứng dụng TestFlight
    if (/^https:\/\/testflight\.apple\.com\/v3\/accounts\/.*\/apps$/.test(url) && key) {
        let headers = Object.fromEntries(Object.entries($request.headers).map(([key, value]) => [key.toLowerCase(), value]))
        let session_id = headers['x-session-id']
        let session_digest = headers['x-session-digest']
        let request_id = headers['x-request-id']

        // Lưu các thông tin cần thiết vào local storage
        $persistentStore.write(session_id, 'session_id')
        $persistentStore.write(session_digest, 'session_digest')
        $persistentStore.write(request_id, 'request_id')
        $persistentStore.write(key, 'key')

        // Thông báo thành công khi lấy được thông tin
        let existingAppIds = $persistentStore.read('APP_ID')
        if (!existingAppIds) {
            $notification.post('Lấy thông tin thành công 🎉', '', 'Vui lòng lấy APP_ID và cấu hình tham số của module sau đó tắt script này' , {"auto-dismiss": 10})
        }
        console.log(`Lấy thông tin thành công: session_id=${session_id}, session_digest=${session_digest}, request_id=${request_id}, key=${key}`)
    } else if (/^https:\/\/testflight\.apple\.com\/join\/([A-Za-z0-9]+)$/.test(url)) {
        // Xử lý khi URL là link mời tham gia TestFlight
        const appIdMatch = url.match(/^https:\/\/testflight\.apple\.com\/join\/([A-Za-z0-9]+)$/)
        handler(appIdMatch)
    } else if (/v3\/accounts\/.*\/ru/.test(url)) {
        // Xử lý khi URL là link chấp nhận mời tham gia TestFlight
        const appIdMatch = url.match(/v3\/accounts\/.*\/ru\/(.*)/)
        handler(appIdMatch)
    }

    $done({})
} else {
    // Xử lý khi không có yêu cầu $request (chạy tự động)
    !(async () => {
        let ids = $persistentStore.read('APP_ID')
        if (!ids) {
            console.log('Không tìm thấy APP_ID đã lưu')
            $done()
        } else {
            ids = ids.split(',')
            for await (const ID of ids) {
                await autoPost(ID, ids)
            }
            if (ids.length === 0) {
                // Thông báo khi đã tham gia hết các TestFlight
                $notification.post('Đã tham gia hết các TestFlight 🎉', '', 'Module đã tự động tắt sau khi hoàn thành', {"sound": true});
                $done($httpAPI('POST', '/v1/modules', {'Công bố thử nghiệm': false}));
            } else {
                $done()
            }
        }
    })()
}

// Hàm thực hiện gửi yêu cầu tham gia TestFlight
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
                console.log(`${ID} Lỗi mạng: ${error}，Giữ lại APP_ID`);
                resolve();
                return;
            }

            if (response.status === 500) {
                console.log(`${ID} Lỗi server, status code 500，Giữ lại APP_ID`);
                resolve();
                return
            }

            if (response.status !== 200) {
                console.log(`${ID} Link không hợp lệ: status code ${response.status}，Xóa APP_ID`)
                ids.splice(ids.indexOf(ID), 1)
                $persistentStore.write(ids.join(','), 'APP_ID')
                $notification.post('Link TestFlight không hợp lệ', '', `${ID} đã được xóa` , {"auto-dismiss": 2})
                resolve()
                return
            }

            let jsonData
            try {
                jsonData = JSON.parse(data)
            } catch (parseError) {
                console.log(`${ID} Lỗi phân tích dữ liệu: ${parseError}，Giữ lại APP_ID`)
                resolve()
                return
            }

            if (!jsonData || !jsonData.data) {
                console.log(`${ID} Không thể tham gia, Giữ lại APP_ID`)
                resolve()
                return
            }

            if (jsonData.data.status === 'FULL') {
                console.log(`${ID} Đã đầy, Giữ lại APP_ID`)
                resolve()
                return
            }

            // Gửi yêu cầu POST để tham gia TestFlight
            $httpClient.post({ url: testurl + ID + '/accept', headers: header }, (error, response, body) => {
                if (!error && response.status === 200) {
                    let jsonBody
                    try {
                        jsonBody = JSON.parse(body)
                    } catch (parseError) {
                        console.log(`${ID} Lỗi phân tích dữ liệu phản hồi tham gia: ${parseError}，Giữ lại APP_ID`)
                        resolve()
                        return
                    }

                    console.log(`${jsonBody.data.name} Tham gia TestFlight thành công`)
                    ids.splice(ids.indexOf(ID), 1)
                    $persistentStore.write(ids.join(','), 'APP_ID')
                    if (ids.length > 0) {
                        $notification.post(jsonBody.data.name + ' Tham gia TestFlight thành công', '', `Tiếp tục xử lý APP ID: ${ids.join(',')}`, {"sound": true})
                    } else {
                        $notification.post(jsonBody.data.name + ' Tham gia TestFlight thành công', '', 'Hoàn thành tất cả các APP ID', {"sound": true})
                    }
                } else {
                    console.log(`${ID} Tham gia thất bại: ${error || `status code ${response.status}`}，Giữ lại APP_ID`)
                }
                resolve()
            })
        })
    })
}