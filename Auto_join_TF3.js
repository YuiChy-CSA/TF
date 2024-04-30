/*
Admin: YuiChy
*/

let ids = $persistentStore.read("APP_ID");
if (!ids) {
    console.log("Không tìm thấy APP_ID. Tất cả các TestFlight đã được thêm, vui lòng đóng thủ công.");
    $done();
}

ids = ids.split(",");

(async () => {
    for (const ID of ids) {
        await autoPost(ID);
    }
    $done();
})();

function autoPost(ID) {
    const key = $persistentStore.read("key");
    const session_id = $persistentStore.read("session_id");
    const session_digest = $persistentStore.read("session_digest");
    const request_id = $persistentStore.read("request_id");

    if (!key || !session_id || !session_digest || !request_id || !ID) {
        console.log(`Thiếu thông tin cần thiết cho ID: ${ID}`);
        resolve();
        return;
    }

    const testurl = `https://testflight.apple.com/v3/accounts/${key}/ru/`;
    const headers = {
        "X-Session-Id": session_id,
        "X-Session-Digest": session_digest,
        "X-Request-Id": request_id,
    };

    return new Promise((resolve) => {
        $httpClient.get({ url: testurl + ID, headers: headers }, (error, response, data) => {
            if (error) {
                console.log(`${ID} Yêu cầu mạng thất bại: ${error}`);
                resolve();
                return;
            }

            if (response.status !== 200) {
                console.log(`${ID} Không thể truy cập: Mã trạng thái ${response.status}`);
                resolve();
                return;
            }

            let jsonData;
            try {
                jsonData = JSON.parse(data);
            } catch (parseError) {
                console.log(`${ID} Lỗi phân tích JSON: ${parseError}`);
                resolve();
                return;
            }

            if (!jsonData || !jsonData.data) {
                console.log(`${ID} Không tìm thấy dữ liệu hoặc dữ liệu không hợp lệ`);
                resolve();
                return;
            }

            if (jsonData.data.status === "FULL") {
                console.log(`${ID} Thử nghiệm đã đầy: ${jsonData.data.message}`);
                resolve();
                return;
            }

            $httpClient.post({ url: testurl + ID + "/accept", headers: headers }, (error, response, body) => {
                if (error) {
                    console.log(`${ID} Tham gia không thành công: ${error}`);
                    resolve();
                    return;
                }

                if (response.status !== 200) {
                    console.log(`${ID} Tham gia không thành công: Mã trạng thái ${response.status}`);
                    resolve();
                    return;
                }

                let jsonBody;
                try {
                    jsonBody = JSON.parse(body);
                } catch (parseError) {
                    console.log(`${ID} Lỗi phân tích JSON: ${parseError}`);
                    resolve();
                    return;
                }

                console.log(`${jsonBody.data.name} Tham gia TestFlight thành công`);
                $notify(jsonBody.data.name, "Tham gia TestFlight thành công", "");
                resolve();
            });
        });
    });
}