import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import QuantityStep from './QuantityStep';

global.IS_REACT_ACT_ENVIRONMENT = true;
let container;
let root;
const item = {
  id: 'cookies', name: 'Black Cat', imageUrls: [], maxQuantity: 18, quantitySold: 0,
  variants: [
    { id: 'six', packSize: 6, priceCents: 2700 },
    { id: 'twelve', packSize: 12, priceCents: 5000 },
  ],
};
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

function render(selections = {}, overrides = {}) {
  const onChange = jest.fn();
  const onContinue = jest.fn();
  act(() => root.render(<QuantityStep categories={[]} uncategorizedItems={[{ ...item, ...overrides }]}
    selections={selections} onChange={onChange} onContinue={onContinue} />));
  return { onChange, onContinue };
}
function button(label) { return container.querySelector(`button[aria-label="${label}"]`); }

test('renders +/- symbols and disables decreasing zero or continuing without packs', () => {
  const { onChange } = render();
  const decrease = button('Decrease 6 pack quantity for Black Cat');
  const increase = button('Increase 6 pack quantity for Black Cat');
  expect(decrease.textContent).toBe('\u2212');
  expect(decrease.disabled).toBe(true);
  expect(increase.textContent).toBe('+');
  act(() => Simulate.click(increase));
  expect(onChange).toHaveBeenCalledWith('six', 1);
  expect(container.querySelector('.presale-primary-button').disabled).toBe(true);
});

test('shares inventory across variants and preserves decrement at the stock limit', () => {
  const { onChange, onContinue } = render({ six: 1, twelve: 1 });
  expect(button('Increase 6 pack quantity for Black Cat').disabled).toBe(true);
  expect(button('Increase 12 pack quantity for Black Cat').disabled).toBe(true);
  act(() => Simulate.click(button('Decrease 12 pack quantity for Black Cat')));
  expect(onChange).toHaveBeenCalledWith('twelve', 0);
  expect(container.querySelector('.presale-total-cookies').textContent).toContain('2 packs');
  expect(container.textContent).toContain('0 cookies remaining');
  act(() => Simulate.click(container.querySelector('.presale-primary-button')));
  expect(onContinue).toHaveBeenCalled();
});

test('enforces the 100-pack cap for unlimited stock', () => {
  render({ six: 100 }, { maxQuantity: undefined });
  expect(button('Increase 6 pack quantity for Black Cat').disabled).toBe(true);
  expect(button('Decrease 6 pack quantity for Black Cat').disabled).toBe(false);
});

test('shows sold-out variants but allows reducing an existing selection after stock changes', () => {
  render({}, { maxQuantity: 0 });
  expect(container.querySelectorAll('.presale-sold-out-label')).toHaveLength(2);
  render({ six: 1 }, { maxQuantity: 0 });
  expect(button('Decrease 6 pack quantity for Black Cat').disabled).toBe(false);
  expect(button('Increase 6 pack quantity for Black Cat').disabled).toBe(true);
});
