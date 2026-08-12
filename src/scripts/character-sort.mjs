const compareText = (left, right) => left.localeCompare(right);
const versionNumber = (version) => {
  const number = Number.parseFloat(version);
  return Number.isFinite(number) ? number : Number.NEGATIVE_INFINITY;
};
const compareVersionNewest = (left, right) =>
  versionNumber(right) - versionNumber(left);
const value = (card, name) => card.dataset[name] ?? '';

export function compareCharacterCards(left, right, sort) {
  const byName = compareText(value(left, 'name'), value(right, 'name'));

  if (sort === 'name') return byName;
  if (sort === 'rarity') {
    return (
      Number(value(right, 'rarity')) - Number(value(left, 'rarity')) || byName
    );
  }
  if (sort === 'release') {
    return (
      compareVersionNewest(
        value(left, 'versionReleased'),
        value(right, 'versionReleased'),
      ) || byName
    );
  }
  if (sort === 'updated') {
    return (
      compareVersionNewest(
        value(left, 'lastUpdated'),
        value(right, 'lastUpdated'),
      ) || byName
    );
  }

  const property = sort === 'weapon' ? 'weapon' : 'element';
  return compareText(value(left, property), value(right, property)) || byName;
}
