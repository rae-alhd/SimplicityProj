function groupImagesByProduct(imageRows) {
  const map = new Map();

  for (const row of imageRows) {
    const list = map.get(row.product_id) || [];
    list.push({
      id: row.id,
      image_url: row.image_url,
      sort_order: row.sort_order,
      is_main: row.is_main,
    });
    map.set(row.product_id, list);
  }

  return map;
}

function resolveMainImageUrl(images, fallbackImageUrl) {
  if (images.length === 0) {
    return fallbackImageUrl ?? null;
  }

  const mainImage = images.find((image) => image.is_main);
  if (mainImage) {
    return mainImage.image_url;
  }

  // imageRows are expected pre-sorted by sort_order, id
  return images[0].image_url;
}

function attachImageData(products, imageRows) {
  const imagesByProduct = groupImagesByProduct(imageRows);

  return products.map((product) => {
    const images = imagesByProduct.get(product.id) || [];

    return {
      ...product,
      main_image_url: resolveMainImageUrl(images, product.image_url),
      images,
    };
  });
}

module.exports = { attachImageData };
