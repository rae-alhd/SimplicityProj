import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminHomepage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [homepageSettings, setHomepageSettings] = useState({
    hero_title: "",
    hero_highlight: "",
    hero_subtitle: "",
    hero_image_url: "",
    primary_button_text: "",
    primary_button_link: "",
    secondary_button_text: "",
    secondary_button_link: "",
    announcement_text: "",
    men_card_image_url: "",
    men_card_title: "",
    women_card_image_url: "",
    women_card_title: "",
    studio_card_image_url: "",
    studio_card_title: "",
  });
  const [loadingHomepageSettings, setLoadingHomepageSettings] = useState(true);
  const [heroImageFile, setHeroImageFile] = useState(null);
  const [cardImageFiles, setCardImageFiles] = useState({
    men: null,
    women: null,
    studio: null,
  });

  const fetchHomepageSettings = async () => {
    try {
      setLoadingHomepageSettings(true);
      const res = await fetch("http://localhost:5000/api/homepage-settings");
      const data = await res.json();
      setHomepageSettings({
        hero_title: data.hero_title || "",
        hero_highlight: data.hero_highlight || "",
        hero_subtitle: data.hero_subtitle || "",
        hero_image_url: data.hero_image_url || "",
        primary_button_text: data.primary_button_text || "",
        primary_button_link: data.primary_button_link || "",
        secondary_button_text: data.secondary_button_text || "",
        secondary_button_link: data.secondary_button_link || "",
        announcement_text: data.announcement_text || "",
        men_card_image_url: data.men_card_image_url || "",
        men_card_title: data.men_card_title || "",
        women_card_image_url: data.women_card_image_url || "",
        women_card_title: data.women_card_title || "",
        studio_card_image_url: data.studio_card_image_url || "",
        studio_card_title: data.studio_card_title || "",
      });
    } catch (err) {
      console.error("Error fetching homepage settings:", err);
    } finally {
      setLoadingHomepageSettings(false);
    }
  };

  const handleSaveHomepageSettings = async () => {
    try {
      const res = await fetch(
        "http://localhost:5000/api/admin/homepage-settings",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(homepageSettings),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Could not save homepage settings.");
        return;
      }

      alert("Homepage settings saved successfully.");
    } catch (err) {
      console.error("Save homepage settings error:", err);
      alert("Something went wrong while saving homepage settings.");
    }
  };

  const handleHeroImageUpload = async () => {
    if (!heroImageFile) return;

    try {
      const formData = new FormData();
      formData.append("image", heroImageFile);

      const res = await fetch(
        "http://localhost:5000/api/admin/homepage-settings/hero-image",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Could not upload hero image.");
        return;
      }

      setHomepageSettings({
        ...homepageSettings,
        hero_image_url: data.hero_image_url || "",
      });
      setHeroImageFile(null);
      alert("Hero image uploaded successfully.");
    } catch (err) {
      console.error("Hero image upload error:", err);
      alert("Something went wrong while uploading the hero image.");
    }
  };

  const handleCardImageUpload = async (cardKey) => {
    const file = cardImageFiles[cardKey];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(
        `http://localhost:5000/api/admin/homepage-settings/card-image/${cardKey}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Could not upload category card image.");
        return;
      }

      const imageUrlKey = `${cardKey}_card_image_url`;
      setHomepageSettings({
        ...homepageSettings,
        [imageUrlKey]: data[imageUrlKey] || "",
      });
      setCardImageFiles({ ...cardImageFiles, [cardKey]: null });
      alert("Category card image uploaded successfully.");
    } catch (err) {
      console.error("Category card image upload error:", err);
      alert("Something went wrong while uploading the category card image.");
    }
  };

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    fetchHomepageSettings();
  }, [token, navigate]);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Simplicity Admin</p>
            <h1 style={styles.title}>Homepage Settings</h1>
            <p style={styles.subtitle}>
              Manage hero, announcement, and category cards.
            </p>
          </div>

          <button onClick={() => navigate("/dashboard")} style={styles.backBtn}>
            Back to Dashboard
          </button>
        </header>

        <section style={styles.formPanel}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.smallEyebrow}>Site Content</p>
              <h2 style={styles.sectionTitle}>Hero, Buttons &amp; Cards</h2>
            </div>
            <span style={styles.muted}>
              {loadingHomepageSettings ? "Loading..." : ""}
            </span>
          </div>

          <div style={styles.formGrid}>
            <input
              style={styles.input}
              placeholder="Hero Title"
              value={homepageSettings.hero_title}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  hero_title: e.target.value,
                })
              }
            />

            <input
              style={styles.input}
              placeholder="Hero Highlighted Line"
              value={homepageSettings.hero_highlight}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  hero_highlight: e.target.value,
                })
              }
            />

            <input
              style={styles.input}
              placeholder="Hero Image URL"
              value={homepageSettings.hero_image_url}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  hero_image_url: e.target.value,
                })
              }
            />

            <div
              style={{
                ...styles.uploadRow,
                gridColumn: "span 3",
              }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setHeroImageFile(e.target.files[0] || null)
                }
              />
              <button onClick={handleHeroImageUpload} style={styles.editBtn}>
                Upload Hero Image
              </button>
            </div>

            <input
              style={{ ...styles.input, gridColumn: "span 3" }}
              placeholder="Hero Subtitle"
              value={homepageSettings.hero_subtitle}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  hero_subtitle: e.target.value,
                })
              }
            />

            <input
              style={styles.input}
              placeholder="Primary Button Text"
              value={homepageSettings.primary_button_text}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  primary_button_text: e.target.value,
                })
              }
            />

            <input
              style={styles.input}
              placeholder="Primary Button Link"
              value={homepageSettings.primary_button_link}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  primary_button_link: e.target.value,
                })
              }
            />

            <input
              style={styles.input}
              placeholder="Secondary Button Text"
              value={homepageSettings.secondary_button_text}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  secondary_button_text: e.target.value,
                })
              }
            />

            <input
              style={styles.input}
              placeholder="Secondary Button Link"
              value={homepageSettings.secondary_button_link}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  secondary_button_link: e.target.value,
                })
              }
            />

            <input
              style={{ ...styles.input, gridColumn: "span 3" }}
              placeholder="Announcement Text (optional)"
              value={homepageSettings.announcement_text}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  announcement_text: e.target.value,
                })
              }
            />

            <p style={{ ...styles.smallEyebrow, gridColumn: "span 3" }}>
              Men Card
            </p>

            <input
              style={{ ...styles.input, gridColumn: "span 3" }}
              placeholder="Men Card Title"
              value={homepageSettings.men_card_title}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  men_card_title: e.target.value,
                })
              }
            />

            <div
              style={{
                ...styles.uploadRow,
                gridColumn: "span 3",
              }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setCardImageFiles({
                    ...cardImageFiles,
                    men: e.target.files[0] || null,
                  })
                }
              />
              <button
                onClick={() => handleCardImageUpload("men")}
                style={styles.editBtn}
              >
                Upload Men Card Image
              </button>
            </div>

            <p style={{ ...styles.smallEyebrow, gridColumn: "span 3" }}>
              Women Card
            </p>

            <input
              style={{ ...styles.input, gridColumn: "span 3" }}
              placeholder="Women Card Title"
              value={homepageSettings.women_card_title}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  women_card_title: e.target.value,
                })
              }
            />

            <div
              style={{
                ...styles.uploadRow,
                gridColumn: "span 3",
              }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setCardImageFiles({
                    ...cardImageFiles,
                    women: e.target.files[0] || null,
                  })
                }
              />
              <button
                onClick={() => handleCardImageUpload("women")}
                style={styles.editBtn}
              >
                Upload Women Card Image
              </button>
            </div>

            <p style={{ ...styles.smallEyebrow, gridColumn: "span 3" }}>
              Custom Studio Card
            </p>

            <input
              style={{ ...styles.input, gridColumn: "span 3" }}
              placeholder="Custom Studio Card Title"
              value={homepageSettings.studio_card_title}
              onChange={(e) =>
                setHomepageSettings({
                  ...homepageSettings,
                  studio_card_title: e.target.value,
                })
              }
            />

            <div
              style={{
                ...styles.uploadRow,
                gridColumn: "span 3",
              }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setCardImageFiles({
                    ...cardImageFiles,
                    studio: e.target.files[0] || null,
                  })
                }
              />
              <button
                onClick={() => handleCardImageUpload("studio")}
                style={styles.editBtn}
              >
                Upload Custom Studio Card Image
              </button>
            </div>

            <button onClick={handleSaveHomepageSettings} style={styles.addBtn}>
              Save Homepage Settings
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f4f2",
    padding: "45px 20px 70px",
    fontFamily: "Georgia, serif",
    color: "#111",
  },
  container: {
    maxWidth: "1180px",
    margin: "0 auto",
  },
  header: {
    marginBottom: "28px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  eyebrow: {
    color: "#b59b5b",
    letterSpacing: "0.24em",
    textTransform: "uppercase",
    fontSize: "12px",
    margin: 0,
  },
  title: {
    fontSize: "42px",
    fontWeight: 400,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    margin: "8px 0",
  },
  subtitle: {
    color: "#888",
    margin: 0,
  },
  backBtn: {
    padding: "12px 18px",
    border: "1px solid #111",
    background: "#fff",
    cursor: "pointer",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontFamily: "Georgia, serif",
  },
  formPanel: {
    background: "#fff",
    border: "1px solid #e0dbd4",
    padding: "24px",
    marginBottom: "22px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "18px",
  },
  smallEyebrow: {
    color: "#b59b5b",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    fontSize: "11px",
    margin: 0,
  },
  sectionTitle: {
    fontSize: "24px",
    fontWeight: 400,
    margin: "5px 0 0",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
  },
  input: {
    padding: "13px",
    border: "1px solid #ddd",
    fontFamily: "Georgia, serif",
    fontSize: "14px",
    background: "#fff",
  },
  addBtn: {
    background: "#111",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontFamily: "Georgia, serif",
    minHeight: "52px",
    fontWeight: "700",
  },
  editBtn: {
    padding: "8px 10px",
    border: "1px solid #111",
    background: "#fff",
    cursor: "pointer",
    marginRight: "8px",
  },
  uploadRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "10px",
  },
  muted: {
    color: "#999",
    fontSize: "13px",
  },
};
