/*
Tác giả Script: Yui Chy
*/

if (typeof $request !== 'undefined' && $request) {
    let url = $request.url

    let keyPattern = /^https:\/\/testflight\.apple\.com\/v3\/accounts\/(.+?)\/apps$/
    let key = url.match(keyPattern) ? url.match(keyPattern)[1] : null
    const handler = (appIdMatch) => {
        if (appIdMatch && appIdMatch[1]) {
            let appId = appIdMatch[1]
            let existingAppIds = $prefs.valueForKey('APP_ID')
            let appIdSet = new Set(existingAppIds ? existingAppIds.split(',') : [])
            if (!appIdSet.has(appId)) {
                appIdSet.add(appId)
                $prefs.setValueForKey(Array.from(appIdSet).join(','), 'APP_ID')
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
    if (/^https:\/\/testflight\.apple\.com\/v3\/accounts\/(.+?)\/apps$/.test(url) && key) {
        let headers = Object.fromEntries(Object.entries($request.headers).map(([key, value]) => [key.toLowerCase(), value]))
        let session_id = headers['x-session-id']
        let session_digest = headers['x-session-digest']
        let request_id = headers['x-request-id']

        $prefs.setValueForKey(session_id, 'session_id')
        $prefs.setValueForKey(session_digest, 'session_digest')
        $prefs.setValueForKey(request_id, 'request_id')
        $prefs.setValueForKey(key, 'key')

        let existingAppIds = $prefs.valueForKey('APP_ID')
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
        let ids = $prefs.valueForKey("APP_ID");
        if (!ids) {
            console.log('Không tìm thấy APP_ID')
            $done()
        } else {
            ids = ids.split(",");
            try {
                for await (const ID of ids) {
                    await autoPost(ID);
                }
            } catch (error) {
                console.log(error);
            }
        }
        $done();
    })()
}

function autoPost(ID) {
    let Key = $prefs.valueForKey("key");
    let testurl = "https://testflight.apple.com/v3/accounts/" + Key + "/ru/";
    let header = {
        "X-Session-Id": `${$prefs.valueForKey("session_id")}`,
        "X-Session-Digest": `${$prefs.valueForKey("session_digest")}`,
        "X-Request-Id": `${$prefs.valueForKey("request_id")}`,
    };
    return new Promise(function (resolve) {
        $task.fetch({ url: testurl + ID, method: "GET", headers: header }).then(
            (resp) => {
                const { body: data } = resp;
                if (resp.status == 404) {
                    let ids = $prefs.valueForKey("APP_ID").split(",");
                    ids = ids.filter((appId) => appId !== ID);
                    $prefs.setValueForKey(ids.toString(), "APP_ID");
                    console.log(ID + " " + "TestFlight không tồn tại và APP_ID đã được xóa tự động");
                    $notification.post(ID, "TestFlight không tồn tại", "APP_ID đã được xóa tự động", {"auto-dismiss": 2});
                } else {
                    let jsonData = JSON.parse(data);
                    if (!jsonData || !jsonData.data) {
                        console.log(ID + " " + "Không thể chấp nhận lời mời, giữ lại APP_ID");
                    } else if (jsonData.data.status === "FULL") {
                        console.log(ID + " " + jsonData.data.message);
                    } else {
                        $task.fetch({ url: testurl + ID + "/accept", method: "POST", headers: header }).then((res) => {
                            const { body } = res;
                            let jsonBody = JSON.parse(body);
                            $notification.post(jsonBody.data.name, "Tham gia TestFlight thành công", "");
                            console.log(jsonBody.data.name + " Tham gia TestFlight thành công");
                            let ids = $prefs.valueForKey("APP_ID").split(",");
                            ids = ids.filter((appId) => appId !== ID);
                            $prefs.setValueForKey(ids.toString(), "APP_ID");
                        });
                    }
                }
                resolve();
            },
            (error) => {
                if (error === "The request timed out.") {
                    console.log(ID + " Request timeout");
                } else {
                    console.log(ID + " " + error);
                }
                resolve();
            }
        );
    });
}
