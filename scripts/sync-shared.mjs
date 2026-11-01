// Sao chép shared/ vào web/src/shared và mobile/src/shared để cả hai dùng chung nội dung.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = ['i18n.js', 'format.js', 'translate.js', 'pricing.js'];
for (const target of ['web/src/shared', 'mobile/src/shared']) {
  mkdirSync(join(root, target), { recursive: true });
  for (const f of files) copyFileSync(join(root, 'shared', f), join(root, target, f));
}
console.log('Đã đồng bộ shared/ -> web, mobile');
