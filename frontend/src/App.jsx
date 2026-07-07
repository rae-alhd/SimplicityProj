import Navbar from "./components/Navbar";
import { useEffect } from "react";
import ProtectedRoute from "./components/ProtectedRoute";
import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CustomizePage from "./pages/CustomizePage";
import ProductListing from "./pages/Products";
import Cart from "./pages/Cart";
import MenPage from "./pages/MenPage";
import WomenPage from "./pages/WomenPage";
import ProductDetails from "./pages/ProductDetails";
import Checkout from "./pages/Checkout";
import OrderSuccess from "./pages/OrderSuccess";
import AdminOrders from "./pages/AdminOrders";
import MyOrders from "./pages/MyOrders";
import AdminCustomization from "./pages/AdminCustomization";
import AdminHomepage from "./pages/AdminHomepage";
import Register from "./pages/Register";


function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const fetchCart = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
  
      const res = await fetch("http://localhost:5000/api/cart", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      // CHECK
      if (!res.ok) {
        console.error("Cart fetch failed:", res.status);
        return;
      }
  
      const data = await res.json();
      setCart(Array.isArray(data) ? data : []);
  
    } catch (err) {
      console.error("Fetch cart error:", err);
    }
  };
  useEffect(() => {
    const token = localStorage.getItem("token");
  
    if (token) {
      fetchCart();
  
      fetch("http://localhost:5000/api/auth/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          setUser(data.user);
        })
        .catch((err) => {
          console.error(err);
        })
        .finally(() => {
          setLoading(false);
        });
  
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <>
      <Navbar
  user={user}
  setUser={setUser}
  cartCount={
    Array.isArray(cart)
      ? cart.reduce((sum, item) => sum + item.quantity, 0)
      : 0
  }
/>
  
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/customize" element={<CustomizePage />} />
        <Route path="/men" element={<MenPage />} />
        <Route path="/women" element={<WomenPage />} />
        <Route 
  path="/products" 
  element={<ProductListing fetchCart={fetchCart} />} 
/>
<Route 
  path="/products/:id" 
  element={<ProductDetails fetchCart={fetchCart} />} 
/>
<Route path="/register" element={<Register />} />
<Route 
  path="/cart" 
  element={<Cart cart={cart} setCart={setCart} fetchCart={fetchCart} />} 
/>

<Route 
  path="/checkout" 
  element={<Checkout fetchCart={fetchCart} />} 
/>
<Route path="/order-success" element={<OrderSuccess />} />
<Route path="/admin/orders" element={<AdminOrders />} />
<Route path="/admin/customization" element={<AdminCustomization />} />
<Route path="/admin/homepage" element={<AdminHomepage />} />
<Route path="/my-orders" element={<MyOrders />} />
  
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Dashboard user={user} setUser={setUser} />
            </ProtectedRoute>
          }
        />
      </Routes>

    </>
  );
}

export default App;