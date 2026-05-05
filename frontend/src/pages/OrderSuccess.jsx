import { useNavigate } from "react-router-dom";

function OrderSuccess() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "80vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fff",
        fontFamily: "Georgia, serif",
        textAlign: "center",
        padding: "40px",
      }}
    >
      <div
        style={{
          maxWidth: "600px",
          border: "1px solid #eee",
          padding: "50px",
          background: "#fafafa",
        }}
      >
        <h1
          style={{
            fontSize: "36px",
            fontWeight: "400",
            letterSpacing: "2px",
            marginBottom: "16px",
          }}
        >
          Order Placed Successfully
        </h1>

        <p
          style={{
            color: "#777",
            fontSize: "16px",
            lineHeight: "1.7",
            marginBottom: "30px",
          }}
        >
          Thank you for your order. Your order has been saved and is currently
          pending confirmation. Online card payment will be connected later
          through a secure provider such as iyzico.
        </p>

        <button
          onClick={() => navigate("/men")}
          style={{
            background: "#111",
            color: "#fff",
            border: "none",
            padding: "14px 28px",
            letterSpacing: "2px",
            textTransform: "uppercase",
            cursor: "pointer",
            marginRight: "12px",
          }}
        >
          Continue Shopping
        </button>

        <button
          onClick={() => navigate("/cart")}
          style={{
            background: "#fff",
            color: "#111",
            border: "1px solid #111",
            padding: "14px 28px",
            letterSpacing: "2px",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          View Cart
        </button>
        <button
  onClick={() => navigate("/my-orders")}
  style={{
    background: "#fff",
    color: "#111",
    border: "1px solid #111",
    padding: "14px 28px",
    letterSpacing: "2px",
    textTransform: "uppercase",
    cursor: "pointer",
    marginLeft: "12px",
  }}
>
  My Orders
</button>
      </div>
    </div>
  );
}

export default OrderSuccess;