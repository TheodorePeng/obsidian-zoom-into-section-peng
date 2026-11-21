const fence = '```';
const sections = ['---\ntags: [zoom-test]\n---\n'];

for (let chapter = 1; chapter <= 40; chapter++) {
	sections.push([
		'# Chapter ' + chapter + ' — A deliberately long heading for narrow Zoom Tab navigation',
		'',
		'%% ',
		'# Hidden title in an Obsidian comment',
		'- Hidden bullet',
		'%%',
		'',
		'- Summary',
		'  - A child with a long label inside the parent Section ' + chapter,
		'    - Third level',
		'      - Fourth level with ![[zoom-test-image.png]] and $a^2+b^2=c^2$.',
		'',
		'  Continued paragraph in chapter ' + chapter + '.',
		'',
		'  ' + fence + 'md',
		'  # Fake code heading',
		'  %%',
		'  - Fake code bullet',
		'  ' + fence,
		'',
		'- - Compact child on the parent\'s line',
		'- A sibling after the compact list',
		'',
	].join('\n'));
}

process.stdout.write(sections.join('\n'));
