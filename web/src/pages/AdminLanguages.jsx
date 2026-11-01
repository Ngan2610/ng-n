import '../components/AdminServices.css';

export default function AdminLanguages() {
  return <>
    <div className="adm-head"><div><h1>Ngôn ngữ được hỗ trợ</h1><p>Các ngôn ngữ hiện có trong trình tạo thuyết minh và phụ đề.</p></div></div>
    <section className="service-record service-table-wrap">
      <h2>Danh sách ngôn ngữ</h2>
      <table><thead><tr><th scope="col">Mã</th><th scope="col">Ngôn ngữ</th><th scope="col">Chức năng</th></tr></thead><tbody>
        <tr><td>vi</td><td>Tiếng Việt</td><td>Nhận diện, phụ đề và lời thuyết minh</td></tr>
        <tr><td>en</td><td>English</td><td>Nhận diện, phụ đề và lời thuyết minh</td></tr>
        <tr><td>zh</td><td>中文</td><td>Nhận diện, phụ đề và lời thuyết minh</td></tr>
      </tbody></table>
      <p className="fine">Danh sách phản ánh các ngôn ngữ được ứng dụng hỗ trợ. Giọng đọc phụ thuộc trình duyệt và hệ điều hành; dịch văn bản cần kết nối dịch vụ dịch.</p>
    </section>
  </>;
}
