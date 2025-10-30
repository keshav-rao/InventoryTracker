import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const Trends = ({ stocks = [], sales = [] }) => {
  // Guard against invalid props
  if (!Array.isArray(stocks) || !Array.isArray(sales)) {
    return <div className="trends-message">Invalid data received</div>;
  }

  // Show empty state if no data
  if (stocks.length === 0 && sales.length === 0) {
    return <div className="trends-message">No data available for trends</div>;
  }

  // Prepare data for chart
  const data = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Purchases',
        data: stocks.map(stock => stock?.overallTotalCost || 0),
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
      {
        label: 'Sales',
        data: sales.map(sale => sale?.soldFor || 0),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      }
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Business Trends',
      },
    },
  };

  return (
    <div className="trends-wrapper" style={{ width: '100%', height: '400px', padding: '20px' }}>
      <Line options={options} data={data} />
    </div>
  );
};

export default Trends;