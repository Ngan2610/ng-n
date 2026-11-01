import { useState } from 'react';
import { serviceAdminApi } from '../api/services.js';
import { ServiceHeader, ServiceState, dateLabel, languageName, matchesSearch, useAdminRecords } from '../components/AdminServiceTools.jsx';

export default function AdminVideos() {
  const state = useAdminRecords(serviceAdminApi.videos);
  const [search, setSearch] = useState('');
  const visible = state.records.filter((record) => matchesSearch(record, search));
  return <>
    <ServiceHeader title="Quản lý video" description="Các dự án khách hàng đã lưu lên máy chủ, cùng tài khoản sở hữu và ngôn ngữ gốc." {...state} search={search} setSearch={setSearch} />
    <ServiceState {...state} empty={!visible.length} />
    {!state.loading && !state.error && visible.length > 0 && <div className="service-record service-table-wrap">
      <table>
        <thead><tr><th scope="col">Mã</th><th scope="col">Tên video</th><th scope="col">Khách hàng</th><th scope="col">Ngôn ngữ gốc</th><th scope="col">Trạng thái</th><th scope="col">Ngày tạo</th></tr></thead>
        <tbody>{visible.map((video) => <tr key={video.id}><td>{video.id}</td><td>{video.title}</td><td>{video.userName}<br />{video.userEmail}</td><td>{languageName(video.originalLanguage)}</td><td>{video.status}</td><td>{dateLabel(video.createdAt)}</td></tr>)}</tbody>
      </table>
    </div>}
  </>;
}
