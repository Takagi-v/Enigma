import React from 'react';
import { Card, Row, Col, Typography, List } from 'antd';
import { PhoneOutlined, MailOutlined, DollarOutlined, InfoCircleOutlined } from '@ant-design/icons';
import './styles/ContactUs.css';

const { Title, Paragraph } = Typography;

function ContactUs() {
  return (
    <div className="contact-us-container">
      <Title level={2} className="page-title">联系我们</Title>
      
      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <Card title="联系方式" className="contact-card">
            <List>
              <List.Item>
                <PhoneOutlined /> 联系电话：[电话号码]
              </List.Item>
              <List.Item>
                <MailOutlined /> 电子邮箱：[邮箱地址]
              </List.Item>
            </List>
          </Card>
        </Col>
        
        <Col xs={24} md={12}>
          <Card title="收费标准" className="pricing-card">
            <List>
              <List.Item>
                <DollarOutlined /> 基础收费：[收费信息]
              </List.Item>
              <List.Item>
                <DollarOutlined /> 长期合作：[优惠信息]
              </List.Item>
            </List>
          </Card>
        </Col>
      </Row>

      <Card title="加盟说明" className="info-card" style={{ marginTop: '24px' }}>
        <List>
          <List.Item>
            <InfoCircleOutlined /> 加盟条件：[条件说明]
          </List.Item>
          <List.Item>
            <InfoCircleOutlined /> 合作流程：[流程说明]
          </List.Item>
          <List.Item>
            <InfoCircleOutlined /> 收益分成：[分成说明]
          </List.Item>
        </List>
      </Card>

      <Card title="关于我们" className="about-card" style={{ marginTop: '24px' }}>
        <Paragraph>
          [公司简介和业务介绍]
        </Paragraph>
      </Card>
    </div>
  );
}

export default ContactUs; 