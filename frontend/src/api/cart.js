const API = "http://localhost:5000/api/cart";

export const getCart = async (token) => {
  const res = await fetch(API, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
};

export const addToCart = async (token, data) => {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return res.json();
};