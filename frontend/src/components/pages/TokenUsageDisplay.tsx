import React, { useEffect, useState } from 'react';
import { useTokenStore, TokenUsage } from '../chat/store/tokenStore';
import { Card, Table, Tabs, Radio, Statistic, Row, Col, Empty } from 'antd';
import type { RadioChangeEvent } from 'antd';

const TokenUsageDisplay: React.FC = () => {
  const { tokenUsage, isLoading, error, fetchTokenUsage } = useTokenStore();
  const [selectedView, setSelectedView] = useState<string>('daily');
  const [timeRange, setTimeRange] = useState<string>('week');
  
  useEffect(() => {
    fetchTokenUsage();
  }, [fetchTokenUsage]);
  
  // Mock data for development purposes
  // Remove this in production
  const mockData: TokenUsage[] = [
    { date: '2023-07-01', promptTokens: 1500, completionTokens: 2500, totalTokens: 4000, model: 'gpt-4' },
    { date: '2023-07-02', promptTokens: 2000, completionTokens: 3000, totalTokens: 5000, model: 'gpt-4' },
    { date: '2023-07-03', promptTokens: 1800, completionTokens: 2800, totalTokens: 4600, model: 'gpt-4' },
    { date: '2023-07-04', promptTokens: 2200, completionTokens: 3200, totalTokens: 5400, model: 'gpt-3.5-turbo' },
    { date: '2023-07-05', promptTokens: 1600, completionTokens: 2600, totalTokens: 4200, model: 'gpt-3.5-turbo' },
    { date: '2023-07-06', promptTokens: 1900, completionTokens: 2900, totalTokens: 4800, model: 'gpt-3.5-turbo' },
    { date: '2023-07-07', promptTokens: 2100, completionTokens: 3100, totalTokens: 5200, model: 'gpt-4' },
  ];
  
  // For development, use mock data; in production, use tokenUsage
  const displayData = mockData.length > 0 ? mockData : tokenUsage;
  
  // Table columns for the table view
  const columns = [
    {
      title: 'วันที่',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: 'โมเดล',
      dataIndex: 'model',
      key: 'model',
    },
    {
      title: 'Prompt Tokens',
      dataIndex: 'promptTokens',
      key: 'promptTokens',
      render: (text: number) => text.toLocaleString(),
    },
    {
      title: 'Completion Tokens',
      dataIndex: 'completionTokens',
      key: 'completionTokens',
      render: (text: number) => text.toLocaleString(),
    },
    {
      title: 'รวม Tokens',
      dataIndex: 'totalTokens',
      key: 'totalTokens',
      render: (text: number) => text.toLocaleString(),
    },
  ];
  
  // Daily summary table columns
  const dailyColumns = [
    {
      title: 'วันที่',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: 'Prompt Tokens',
      dataIndex: 'promptTokens',
      key: 'promptTokens',
      render: (text: number) => text.toLocaleString(),
    },
    {
      title: 'Completion Tokens',
      dataIndex: 'completionTokens',
      key: 'completionTokens',
      render: (text: number) => text.toLocaleString(),
    },
    {
      title: 'รวม Tokens',
      dataIndex: 'totalTokens',
      key: 'totalTokens',
      render: (text: number) => text.toLocaleString(),
    },
  ];
  
  // Model summary table columns
  const modelColumns = [
    {
      title: 'โมเดล',
      dataIndex: 'model',
      key: 'model',
    },
    {
      title: 'Prompt Tokens',
      dataIndex: 'promptTokens',
      key: 'promptTokens',
      render: (text: number) => text.toLocaleString(),
    },
    {
      title: 'Completion Tokens',
      dataIndex: 'completionTokens',
      key: 'completionTokens',
      render: (text: number) => text.toLocaleString(),
    },
    {
      title: 'รวม Tokens',
      dataIndex: 'totalTokens',
      key: 'totalTokens',
      render: (text: number) => text.toLocaleString(),
    },
  ];
  
  // Aggregate data by day
  const dailyData = displayData.reduce((acc, item) => {
    const date = item.date;
    if (!acc[date]) {
      acc[date] = {
        date,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      };
    }
    acc[date].promptTokens += item.promptTokens;
    acc[date].completionTokens += item.completionTokens;
    acc[date].totalTokens += item.totalTokens;
    return acc;
  }, {} as Record<string, { date: string; promptTokens: number; completionTokens: number; totalTokens: number }>);
  
  const dailyTableData = Object.values(dailyData).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  ).map((item, index) => ({ ...item, key: index }));
  
  // Aggregate data by model
  const modelData = displayData.reduce((acc, item) => {
    const model = item.model;
    if (!acc[model]) {
      acc[model] = {
        model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      };
    }
    acc[model].promptTokens += item.promptTokens;
    acc[model].completionTokens += item.completionTokens;
    acc[model].totalTokens += item.totalTokens;
    return acc;
  }, {} as Record<string, { model: string; promptTokens: number; completionTokens: number; totalTokens: number }>);
  
  const modelTableData = Object.values(modelData).map((item, index) => ({ ...item, key: index }));
  
  const handleTimeRangeChange = (event: RadioChangeEvent) => {
    setTimeRange(event.target.value);
  };
  
  if (isLoading) {
    return <div className="flex justify-center items-center h-64">กำลังโหลดข้อมูล...</div>;
  }
  
  if (error) {
    return <div className="p-4 bg-red-100 text-red-700 rounded-md">เกิดข้อผิดพลาด: {error}</div>;
  }
  
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">การใช้งาน Token</h1>
      
      <Tabs
        activeKey={selectedView}
        onChange={(key) => setSelectedView(key)}
        items={[
          {
            key: 'daily',
            label: 'รายวัน',
            children: (
              <>
                <div className="mb-4">
                  <Radio.Group value={timeRange} onChange={handleTimeRangeChange}>
                    <Radio.Button value="week">7 วัน</Radio.Button>
                    <Radio.Button value="month">30 วัน</Radio.Button>
                    <Radio.Button value="year">1 ปี</Radio.Button>
                  </Radio.Group>
                </div>
                <Card title="การใช้งาน Token รายวัน">
                  {dailyTableData.length > 0 ? (
                    <Table 
                      columns={dailyColumns}
                      dataSource={dailyTableData}
                      pagination={{ pageSize: 7 }}
                    />
                  ) : (
                    <Empty description="ไม่มีข้อมูล" />
                  )}
                </Card>
              </>
            ),
          },
          {
            key: 'model',
            label: 'แยกตามโมเดล',
            children: (
              <Card title="การใช้งาน Token แยกตามโมเดล">
                {modelTableData.length > 0 ? (
                  <Table 
                    columns={modelColumns}
                    dataSource={modelTableData}
                    pagination={{ pageSize: 5 }}
                  />
                ) : (
                  <Empty description="ไม่มีข้อมูล" />
                )}
              </Card>
            ),
          },
          {
            key: 'table',
            label: 'ตาราง',
            children: (
              <Card title="ตารางการใช้งาน Token">
                {displayData.length > 0 ? (
                  <Table 
                    columns={columns}
                    dataSource={displayData.map((item, index) => ({ ...item, key: index }))}
                    pagination={{ pageSize: 10 }}
                  />
                ) : (
                  <Empty description="ไม่มีข้อมูล" />
                )}
              </Card>
            ),
          },
        ]}
      />
      
      <Card title="สรุปการใช้งาน" className="mt-8">
        <Row gutter={16}>
          <Col span={8}>
            <Card className="bg-blue-50">
              <Statistic
                title="Prompt Tokens"
                value={displayData.reduce((sum, item) => sum + item.promptTokens, 0)}
                formatter={(value) => `${value.toLocaleString()}`}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card className="bg-green-50">
              <Statistic
                title="Completion Tokens"
                value={displayData.reduce((sum, item) => sum + item.completionTokens, 0)}
                formatter={(value) => `${value.toLocaleString()}`}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card className="bg-purple-50">
              <Statistic
                title="รวม Tokens"
                value={displayData.reduce((sum, item) => sum + item.totalTokens, 0)}
                formatter={(value) => `${value.toLocaleString()}`}
              />
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default TokenUsageDisplay; 