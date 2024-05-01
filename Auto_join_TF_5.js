/*
Tác giả Script: Yui Chy
*/

const ids = persist.store.get('APP_ID');

if (!ids) {
    console.log('Chưa thêm TestFlight APP_ID, vui lòng thêm hoặc sử dụng liên kết TestFlight để tự động lấy');
} else if (ids === '') {
    console.log('Đã tham gia hết tất cả TestFlight, vui lòng tắt plugin này thủ công');
} else {
    const idList = ids.split(',');

    (async () => {
        for (const ID of idList) {
            await autoPost(ID);
        }
        $done();
    })();
}

function autoPost(ID) {
    const Key = persist.store.get('key');
    const testurl = `https://testflight.apple.com/v3/accounts/${Key}/ru/`;
    const header = {
        'X-Session-Id': persist.store.get('session_id'),
        'X-Session-Digest': persist.store.get('session_digest'),
        'X-Request-Id': persist.store.get('request_id'),
        'User-Agent': persist.store.get('tf_ua')
    };

    return new Promise((resolve) => {
        $httpClient.get({
            url: `${testurl}${ID}`,
            headers: header
        }, (error, resp, data) => {
            if (error) {
                if (error === 'The request timed out.') {
                    resolve();
                } else {
                    console.log(`${ID} ${error}`);
                    resolve();
                }
            } else {
                if (resp.status === 404) {
                    let ids = persist.store.get('APP_ID').split(',');
                    ids = ids.filter(item => item !== ID);
                    persist.store.put('APP_ID', ids.join(','));
                    console.log(`${ID} Không tồn tại TestFlight này, đã tự động xóa APP_ID này`);
                    console.log(`${ID}`);
                    resolve();
                } else {
                    const jsonData = JSON.parse(data);
                    if (jsonData.data === null) {
                        console.log(`${ID} ${jsonData.messages[0].message}`);
                        resolve();
                    } else if (jsonData.data.status === 'FULL') {
                        console.log(`${jsonData.data.app.name} ${ID} ${jsonData.data.message}`);
                        resolve();
                    } else {
                        $httpClient.post({
                            url: `${testurl}${ID}/accept`,
                            headers: header
                        }, (error, resp, body) => {
                            const jsonBody = JSON.parse(body);
                            console.log(`${jsonBody.data.name} Tham gia TestFlight thành công`);
                            let ids = persist.store.get('APP_ID').split(',');
                            ids = ids.filter(item => item !== ID);
                            persist.store.put('APP_ID', ids.join(','));
                            resolve();
                        });
                    }
                }
            }
        });
    });
}
