const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'greeting.mp4');

function generateDailyGreeting() {
  const now = new Date();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayName = days[now.getUTCDay()];
  const monthName = months[now.getUTCMonth()];
  const date = now.getUTCDate();
  const year = now.getUTCFullYear();
  const dateStr = `${dayName}, ${monthName} ${date}, ${year}`;

  const existing = fs.existsSync(OUTPUT_PATH);
  if (existing) {
    const stat = fs.statSync(OUTPUT_PATH);
    const fileDate = stat.mtime.toISOString().slice(0, 10);
    const todayStr = now.toISOString().slice(0, 10);
    if (fileDate === todayStr) {
      console.log(`☀️ [GREETING] Already generated for today (${todayStr}), skipping`);
      return { generated: false, date: todayStr };
    }
  }

  console.log(`☀️ [GREETING] Generating daily greeting video for ${dateStr}...`);

  const line1 = "Good morning,";
  const line2 = "have a Solar Day!";
  const line3 = dateStr;
  const line4 = "Have a clear day, life is what YOU make it!";
  const line5 = "TC-S Network Foundation";

  const filterComplex = [
    `color=c=0x0a0a14:s=1280x720:d=8,format=yuv420p[bg]`,
    `color=c=0xFF8C00:s=1276x2:d=8[border_top]`,
    `color=c=0xFF8C00:s=1276x2:d=8[border_bot]`,
    `color=c=0xFF8C00:s=2x716:d=8[border_left]`,
    `color=c=0xFF8C00:s=2x716:d=8[border_right]`,
    `[bg][border_top]overlay=2:2[t1]`,
    `[t1][border_bot]overlay=2:716[t2]`,
    `[t2][border_left]overlay=0:2[t3]`,
    `[t3][border_right]overlay=1278:2[bordered]`,
    `[bordered]drawtext=text='☀️':fontsize=72:fontcolor=white:x=(w-tw)/2:y=120:enable='gte(t,0.3)'[s1]`,
    `[s1]drawtext=text='${line1}':fontsize=48:fontcolor=0xFFD700:x=(w-tw)/2:y=220:enable='gte(t,0.5)'[s2]`,
    `[s2]drawtext=text='${line2}':fontsize=48:fontcolor=0xFFD700:x=(w-tw)/2:y=280:enable='gte(t,0.8)'[s3]`,
    `[s3]drawtext=text='${line3}':fontsize=30:fontcolor=0x00f5d4:x=(w-tw)/2:y=370:enable='gte(t,1.2)'[s4]`,
    `[s4]drawtext=text='${line4}':fontsize=24:fontcolor=0xdddddd:x=(w-tw)/2:y=440:enable='gte(t,1.8)'[s5]`,
    `[s5]drawtext=text='YOU':fontsize=24:fontcolor=0xFFD700:x=(w/2+42):y=440:enable='gte(t,1.8)'[s6]`,
    `[s6]drawtext=text='${line5}':fontsize=16:fontcolor=0x888888:x=(w-tw)/2:y=600:enable='gte(t,2.5)'`
  ].join(';');

  const tmpPath = OUTPUT_PATH + '.tmp.mp4';

  try {
    execSync(
      `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -filter_complex "${filterComplex}" -t 8 -c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -c:a aac -shortest "${tmpPath}"`,
      { timeout: 30000, stdio: 'pipe' }
    );
    fs.renameSync(tmpPath, OUTPUT_PATH);
    const size = fs.statSync(OUTPUT_PATH).size;
    console.log(`☀️ [GREETING] Generated successfully (${(size/1024).toFixed(0)} KB) for ${dateStr}`);
    return { generated: true, date: dateStr, size };
  } catch (err) {
    console.error(`☀️ [GREETING] ffmpeg error:`, err.message);
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    return { generated: false, error: err.message };
  }
}

function scheduleDailyGreeting() {
  generateDailyGreeting();

  const now = new Date();
  const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 30));
  const msUntil = nextMidnight.getTime() - now.getTime();

  console.log(`☀️ [GREETING] Next generation scheduled in ${(msUntil / 3600000).toFixed(1)} hours (midnight UTC)`);

  setTimeout(function tick() {
    generateDailyGreeting();
    setTimeout(tick, 24 * 60 * 60 * 1000);
  }, msUntil);
}

module.exports = { generateDailyGreeting, scheduleDailyGreeting };
