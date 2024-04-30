/*
Tác giả script: DecoAri
Người sửa chữa: YuiChy
*/

(async () => {
    const SESSION_ID_KEY = "session_id";
    const SESSION_DIGEST_KEY = "session_digest";
    const REQUEST_ID_KEY = "request_id";
    const APP_ID_KEY = "APP_ID"; // Định nghĩa khóa cho APP_ID

    const ids = localStorage.getItem(APP_ID_KEY); // Đọc APP_ID từ cơ sở dữ liệu cục bộ
    if (!ids) {
        $notify("Tất cả các TestFlight đã được thêm", "Vui lòng đóng thủ công", "");
        $done();
        return;
    }

    const idArray = ids.split(",");
    for (const ID of idArray) {
        try {
            await autoPost(ID);
        } catch (error) {
            console.log(error);
        }
    }

    $done();

    async function autoPost(ID) {
        const KEY_KEY = localStorage.getItem('key'); // Đọc giá trị 'key' từ cơ sở dữ liệu cục bộ
        const testUrl = `https://testflight.apple.com/v3/accounts/${KEY_KEY}/ru/`;
        const header = {
            "X-Session-Id": `${localStorage.getItem(SESSION_ID_KEY)}`,
            "X-Session-Digest": `${localStorage.getItem(SESSION_DIGEST_KEY)}`,
            "X-Request-Id": `${localStorage.getItem(REQUEST_ID_KEY)}`,
        };

        const resp = await $task.fetch({
            url: testUrl + ID,
            method: "GET",
            headers: header
        });

        const { status, body } = resp;
        if (status === 404) {
            handleNotFound(ID);
        } else {
            handleResponse(body, ID, testUrl, header);
        }
    }

    function handleNotFound(ID) {
        const currentIds = localStorage.getItem(APP_ID_KEY).split(","); // Đọc và cập nhật lại danh sách APP_ID
        const updatedIds = currentIds.filter((appId) => appId !== ID);
        localStorage.setItem(APP_ID_KEY, updatedIds.join(',')); // Lưu lại danh sách APP_ID mới
        console.log(`${ID} Không tồn tại TestFlight này và APP_ID đã được xóa tự động`);
        $notify(ID, "Không tồn tại TestFlight", "APP_ID đã được xóa tự động");
    }

    async function handleResponse(data, ID, testUrl, header) {
        const jsonData = JSON.parse(data);
        if (!jsonData.data) {
            console.log(`${ID} ${jsonData.messages[0].message}`);
            return;
        }
        if (jsonData.data.status === "FULL") {
            console.log(`${ID} ${jsonData.data.message}`);
            return;
        }

        const acceptUrl = testUrl + ID + "/accept";
        const acceptResp = await $task.fetch({
            url: acceptUrl,
            method: "POST",
            headers: header
        });

        const acceptBody = await acceptResp.body.json();
        $notify(acceptBody.data.name, "TestFlight tham gia thành công", "");
        console.log(`${acceptBody.data.name} TestFlight tham gia thành công`);

        const currentIds = localStorage.getItem(APP_ID_KEY).split(","); // Đọc và cập nhật lại danh sách APP_ID
        const updatedIds = currentIds.filter((appId) => appId !== ID);
        localStorage.setItem(APP_ID_KEY, updatedIds.join(',')); // Lưu lại danh sách APP_ID mới
    }
})();
