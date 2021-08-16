import { render, screen } from '@testing-library/react';
import App from './App';

test('navバー表示', () => {
  render(<App />);
  const linkElement = screen.getByText(/NeuXML/i);
  expect(linkElement).toBeInTheDocument();
});

test('広告の存在', () =>{
  render(<App/>)
  const adv = screen.getByText(/広告/i)
  expect(adv).toBeInTheDocument()
})
