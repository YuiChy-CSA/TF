/*
Script Author: Yui Chy
*/

// Định nghĩa hàm chính để chạy trong ứng dụng Loon
function main() {
    const ids = $persistentStore.read('APP_ID');
    if (ids === null) {
        $notification.post('Chưa thêm TestFlight APP_ID', 'Vui lòng thêm hoặc sử dụng liên kết TestFlight để tự động lấy', '');
        $done();
        return;
    }

    if (ids === '') {
        $notification.post('Đã tham gia hết tất cả TestFlight', 'Vui lòng tắt plugin này thủ công', '');
        $done();
        return;
    }

    const idArray = ids.split(',');
    for (const ID of idArray) {
        await autoPost(ID);
    }

    $done();
}

// Định nghĩa hàm xử lý autoPost
function autoPost(ID) {
    const Key = $persistentStore.read('key');
    const testurl = `https://testflight.apple.com/v3/accounts/${Key}/ru/`;
    const header = {
        'X-Session-Id': $persistentStore.read('session_id'),
        'X-Session-Digest': $persistentStore.read('session_digest'),
        'X-Request-Id': $persistentStore.read('request_id'),
        'User-Agent': $persistentStore.read('tf_ua')
    };

    return new Promise((resolve) => {
        $httpClient.get({ url: `${testurl}${ID}`, headers: header }, (error, resp, data) => {
            if (error === null) {
                if (resp.status === 404) {
                    let ids = $persistentStore.read('APP_ID').split(',');
                    ids = ids.filter((appId) => appId !== ID);
                    $persistentStore.write(ids.toString(), 'APP_ID');
                    console.log(`${ID} Không tồn tại TestFlight này, đã tự động xóa APP_ID này`);
                    $notification.post(ID, 'Không tồn tại TestFlight', 'Đã tự động xóa APP_ID này');
                } else {
                    const jsonData = JSON.parse(data);
                    if (jsonData.data === null) {
                        console.log(`${ID} ${jsonData.messages[0].message}`);
                    } else if (jsonData.data.status === 'FULL') {
                        console.log(`${jsonData.data.app.name} ${ID} ${jsonData.data.message}`);
                    } else {
                        $httpClient.post({ url: `${testurl}${ID}/accept`, headers: header }, (error, resp, body) => {
                            const jsonBody = JSON.parse(body);
                            $notification.post(jsonBody.data.name, 'Tham gia TestFlight thành công', '');
                            console.log(`${jsonBody.data.name} Tham gia TestFlight thành công`);
                            let ids = $persistentStore.read('APP_ID').split(',');
                            ids = ids.filter((appId) => appId !== ID);
                            $persistentStore.write(ids.toString(), 'APP_ID');
                        });
                    }
                }
            } else {
                if (error === 'The request timed out.') {
                    resolve();
                } else {
                    $notification.post('Tự động tham gia TestFlight', error, '');
                    console.log(`${ID} ${error}`);
                }
            }
            resolve();
        });
    });
}

// Gọi hàm chính để bắt đầu chạy
main();