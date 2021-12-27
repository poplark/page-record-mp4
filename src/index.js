const { launch, getStream }  = require('puppeteer-stream');
const ffmpeg = require('fluent-ffmpeg');

async function run(url = 'https://www.douyu.com/', filename = __dirname + '/record.mp4') {
  const browser = await launch({
    // 解除浏览器自动播放限制
    args: ['--autoplay-policy=no-user-gesture-required'],
    defaultViewport: {
      width: 1920,
      height: 1080,
    }
  });

  const page = await browser.newPage();

  return new Promise(async (resolve, reject) => {
    const stream = await getStream(page, {
      audio: true,
      video: true,
    });

    stream.on('pause', () => {
      console.log('stream paused');
    }).on('end', () => {
      console.log('stream ended');
    }).on('close', () => {
      console.log('stream closed');
    }).on('error', (err) => {
      console.log('stream error', err);
      reject(err);
    });

    // 将直接保存为 webm 格式的录制文件
    // stream.pipe(file);

    const converter = ffmpeg()
      .input(stream)
      .inputFormat('webm')
      .toFormat('mp4')
      // 尽量使用小的帧率为降低转码时对计算资源的消耗，以提高转码速度，但仍不能保证生产的数据不堆积
      .fps(20)
      // 利用下面两条配置项，可 output 到 stream ，否则将报错
      // .outputOptions('-movflags frag_keyframe+empty_moov')
      // .outputOptions('-preset ultrafast')
      .on('start', () => { 
        console.log('--- start converting webm to mp4 ---');
      })
      .on('stderr', function(stderrLine) {
        console.log('converter stderr output:', stderrLine);
      })
      .on('error', (e) => { 
        console.error('converter error: ', e);
        reject(err);
      })
      .on('end', () => { 
        console.log('converter ended');
        // todo - 为啥触发为了 ffmpeg 的 end 事件？？？？
        resolve();
      })
      .output(filename)
      .run();

    // 如何 url 打开时，页面卡住（可能会超时），如何处理
    await page.goto(url);

    setTimeout(async () => {
      await stream.destroy();
      await browser.close();
      // todo
      // 1. 如何在 stream 销毁时，通知 converter，并决定停止 convert
      // 2. 若 stream 销毁时，converter 仍需时间转码缓存中的数据，如何在消费完缓存中的数据后通知 main thread 完结
      // 3. 若 converter 消费的速度赶不上 stream 生产的数据，缓存越来越多，内存是否会耗尽 - 不会，因为背压会起作用，但反过来，会不会导致页面录制数据丢失，如何处理？
    }, 20 * 1000);
  });
}

run('https://demopre.urtc.com.cn/trial/#/?roomId=test-set1&auto=true&roomType=rtc')
  .then(() => {
    console.log('--- end ---');
  })
  .catch((err) => {
    console.log('--- run error ---', err);
  });
