import React, { useState, useEffect } from 'react';
import { Rate } from 'antd';
import { useAuth } from '../contexts/AuthContext';
import config from '../config';
import './styles/Reviews.css';

const Reviews = ({ parkingSpotId, onReviewSubmitted }) => {
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState({ rating: 0, comment: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { user, authFetch } = useAuth();

  useEffect(() => {
    fetchReviews();
  }, [parkingSpotId]);

  const fetchReviews = async () => {
    try {
      const response = await fetch(`${config.API_URL}/parking-spots/${parkingSpotId}/reviews`);
      if (!response.ok) throw new Error('获取评论失败');
      const data = await response.json();
      setReviews(data.reviews || []);
    } catch (error) {
      console.error('获取评论失败:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('请先登录');
      return;
    }
    if (newReview.rating === 0) {
      setError('请选择评分');
      return;
    }

    try {
      setSubmitting(true);
      const response = await authFetch(`${config.API_URL}/parking-spots/${parkingSpotId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newReview),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || '提交评论失败');
      }

      setNewReview({ rating: 0, comment: '' });
      await fetchReviews();
      setError(null);
      
      // 调用提交成功的回调
      if (onReviewSubmitted) {
        onReviewSubmitted();
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="reviews-loading">加载中...</div>;

  return (
    <div className="reviews-container">
      <h3>用户评价</h3>
      
      {user && (
        <div className="review-form">
          <h4>添加评论</h4>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="rating-input">
              <label>评分：</label>
              <Rate 
                value={newReview.rating}
                onChange={value => setNewReview(prev => ({ ...prev, rating: value }))}
              />
            </div>
            <div className="comment-input">
              <textarea
                value={newReview.comment}
                onChange={e => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
                placeholder="写下您的评价..."
                required
              />
            </div>
            <button type="submit" disabled={submitting}>
              {submitting ? '提交中...' : '提交评价'}
            </button>
          </form>
        </div>
      )}

      <div className="reviews-list">
        {reviews.length === 0 ? (
          <p className="no-reviews">暂无评价</p>
        ) : (
          reviews.map(review => (
            <div key={review.id} className="review-item">
              <div className="review-header">
                <div className="user-info">
                  {review.avatar && (
                    <img src={review.avatar} alt={review.username} className="user-avatar" />
                  )}
                  <span className="username">{review.username}</span>
                </div>
                <Rate disabled defaultValue={review.rating} />
              </div>
              <p className="review-comment">{review.comment}</p>
              <div className="review-time">
                {new Date(review.created_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Reviews; 