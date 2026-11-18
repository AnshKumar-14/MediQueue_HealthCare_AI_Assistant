import Header from "./components/Header";
import Footer from "./components/Footer";
import Image from "next/image";

export default function Login({ children }) {
  return (
    <div className="bg-white">
      {/* <Header/> */}
      {children}
      {/* <Footer/> */}
    </div>
  );
}