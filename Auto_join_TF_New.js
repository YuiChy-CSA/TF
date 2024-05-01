/*
Script Author: Yui Chy
*/

!(async () => {
  const reg1 = /^https:\/\/testflight\.apple\.com\/v3\/accounts\/(.*)\/apps$/;
  const reg2 = /^https:\/\/testflight\.apple\.com\/join\/(.*)/;

  const ids = $persistentStore.read('APP_ID');

  if (reg1.test($request.url)) {
    // Handle request to fetch TestFlight information
    const url = $request.url;
    const key = url.replace(/(.*accounts\/)(.*)(\/apps)/, '$2');
    const session_id = $request.headers['X-Session-Id'] || $request.headers['x-session-id'];
    const session_digest = $request.headers['X-Session-Digest'] || $request.headers['x-session-digest'];
    const request_id = $request.headers['X-Request-Id'] || $request.headers['x-request-id'];
    const ua = $request.headers['User-Agent'] || $request.headers['user-agent'];
    
    $persistentStore.write(key, 'key');
    $persistentStore.write(session_id, 'session_id');
    $persistentStore.write(session_digest, 'session_digest');
    $persistentStore.write(request_id, 'request_id');
    $persistentStore.write(ua, 'tf_ua');
    
    console.log($request.headers);

    if (request_id !== null) {
      $notification.post('TF thông tin', 'Thu thập thông tin thành công, vui lòng tắt script!', '');
    } else {
      $notification.post('TF thông tin', 'Thu thập thông tin thất bại, vui lòng bật Mitm over HTTP2 và khởi động lại VPN và ứng dụng TestFlight!', '');
    }
  }

  if (reg2.test($request.url) && ids) {
    // Handle request to join TestFlight
    let arr = ids.split(',').map(item => item.trim()).filter(item => item !== '');
    const id = reg2.exec($request.url)[1];
    arr.push(id);
    arr = [...new Set(arr)]; // Remove duplicates
    $persistentStore.write(arr.join(","), "APP_ID");
    $notification.post("Tự động tham gia TestFlight", `Đã thêm APP_ID: ${id}`, `ID hiện tại: ${arr.join(",")}`);
  }

  if (ids && ids !== '') {
    // Auto join TestFlight apps
    const appIds = ids.split(',').map(item => item.trim()).filter(item => item !== '');
    for (const ID of appIds) {
      await autoJoin(ID);
    }
  }

  $done();
})();

async function autoJoin(ID) {
  const key = $persistentStore.read('key');
  const testurl = `https://testflight.apple.com/v3/accounts/${key}/ru/`;
  const headers = {
    'X-Session-Id': $persistentStore.read('session_id'),
    'X-Session-Digest': $persistentStore.read('session_digest'),
    'X-Request-Id': $persistentStore.read('request_id'),
    'User-Agent': $persistentStore.read('tf_ua'),
  };

  return new Promise(resolve => {
    $httpClient.get({ url: testurl + ID, headers: headers }, (error, resp, data) => {
      if (error !== null) {
        if (error === 'The request timed out.') {
          // Handle timeout error
        } else {
          $notification.post('Tự động tham gia TestFlight', `Lỗi: ${error}`, '');
          console.log(`${ID} Lỗi: ${error}`);
        }
      } else {
        if (resp.status === 404) {
          let ids = $persistentStore.read('APP_ID').split(',').map(item => item.trim()).filter(item => item !== '');
          ids = ids.filter(appID => appID !== ID);
          $persistentStore.write(ids.join(','), 'APP_ID');
          console.log(`${ID} Không tồn tại TestFlight này, đã tự động xóa APP_ID này`);
          $notification.post(ID, 'Không tồn tại TestFlight', 'Đã tự động xóa APP_ID này');
        } else {
          const jsonData = JSON.parse(data);
          if (jsonData.data === null) {
            console.log(`${ID} ${jsonData.messages[0].message}`);
          } else if (jsonData.data.status === 'FULL') {
            console.log(`${jsonData.data.app.name} ${ID} ${jsonData.data.message}`);
          } else {
            $httpClient.post({ url: testurl + ID + '/accept', headers: headers }, (error, resp, body) => {
              const jsonBody = JSON.parse(body);
              $notification.post(jsonBody.data.name, 'Tham gia TestFlight thành công', '');
              console.log(`${jsonBody.data.name} Tham gia TestFlight thành công`);
              let ids = $persistentStore.read('APP_ID').split(',').map(item => item.trim()).filter(item => item !== '');
              ids = ids.filter(appID => appID !== ID);
              $persistentStore.write(ids.join(','), 'APP_ID');
            });
          }
        }
      }
      resolve();
    });
  });
}
