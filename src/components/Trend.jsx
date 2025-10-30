import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

const Trend = ({ stockData }) => {
  const processedData = useMemo(() => {
    if (!Array.isArray(stockData)) return [];
    
    const stocksByProduct = {};
    
    stockData.forEach(stock => {
      if (!stock?.product) return;
      
      if (!stocksByProduct[stock.product]) {
        stocksByProduct[stock.product] = {
          product: stock.product,
          sizes: SIZES.reduce((acc, size) => ({ ...acc, [size]: 0 }), {})
        };
      }
      
      if (stock.sizes) {
        Object.entries(stock.sizes).forEach(([size, quantity]) => {
          if (SIZES.includes(size)) {
            stocksByProduct[stock.product].sizes[size] = 
              (stocksByProduct[stock.product].sizes[size] || 0) + (quantity || 0);
          }
        });
      }
    });

    return Object.values(stocksByProduct);
  }, [stockData]);

  if (!processedData.length) {
    return <div className="p-4">No stock data available</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Stock Trends</h2>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart 
          data={processedData} 
          margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="product" />
          <YAxis />
          <Tooltip />
          <Legend />
          {SIZES.map((size, index) => (
            <Bar 
              key={size} 
              dataKey={`sizes.${size}`}
              stackId="a" 
              fill={COLORS[index % COLORS.length]} 
              name={`Size ${size}`}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

Trend.defaultProps = {
  stockData: []
};

export default Trend;