const compareText = (left, right) => left.localeCompare(right);
const value = (card, name) => card.dataset[name] ?? '';

export function compareCharacterCards(left, right, sort) {
  const byName = compareText(value(left, 'name'), value(right, 'name'));

  if (sort === 'name') return byName;
  if (sort === 'rarity') {
    return (
      Number(value(right, 'rarity')) - Number(value(left, 'rarity')) || byName
    );
  }

  const property = sort === 'weapon' ? 'weapon' : 'element';
  return compareText(value(left, property), value(right, property)) || byName;
}
